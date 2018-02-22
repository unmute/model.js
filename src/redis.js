//
const RSet = require('./RSet')
const cache = {}
const _ = require('lodash')
const Types = require('./types')
const k = (model, id) => {
	return (cache[model.ns] ? cache[model.ns].n : (cache[model.ns] = {n:model.ns + ':'}).n) + id
}

let redis = undefined

class RedisORM {
	constructor(db) {
		redis = db
	}
	getDB() {
		return redis
	}
	init(model, body) {
		let s = model._info.schema
		_.each(s, (type, k) => {
			let t = type.type || type
			let v = body[k]
			if (v === undefined)
				return
			if (Array.isArray(t))
				return
			if (t && v) {
				if (t === Types.Int)
					v = parseInt(v)
				else if (t === Types.Double)
					v = parseFloat(v)
				else if (t === Types.Date)
					v = Date.parse(v) ? new Date(v) : null
				else if (t === Types.Boolean)
					v = _.isBoolean(v) ? v : (v === 'true')
				else if (t === Types.JSON)
					v = JSON.parse(v)
			}
			body[k] = v
		})
		return new model(body)
	}
	fill(model, instances) {
		let i = model._info
		if (!_.size(i.requiredRelationships))
			return Promise.resolve(instances)
		let needs = {}
		let models = {}
		_.each(instances, (instance) => {
			_.each(i.model_rels, (tm, k) => {
				if (!instance[k])
					return
				let t = (tm)
				needs[t.ns] = needs[t.ns] || {}
				needs[t.ns][instance[k]] = true
				models[t.ns] = t
			})
			_.each(i.set_rels, (tm, k) => {
				let t = (tm)
				needs[t.ns] = needs[t.ns] || {}
				let it = instance[k]
				let set_instances = it.array
				_.each(set_instances, (instance) => {
					needs[t.ns][instance] = true
				})
				models[t.ns] = t
			})
		})
		let promises = _.map(needs, (ids, model) => models[model].many(_.keys(ids)))
		return Promise.all(promises)
			.then((fills) => {
				let byKey = _.keyBy(_.flatten(fills), 'id')
				_.each(instances, instance => {
					_.each(i.model_rels, (t, k) => {
						instance[k] = byKey[instance[k]]
					})
					_.each(i.set_rels, (t, k) => {
						let instances = _.map((instance[k]).array, id => {
							return byKey[id]
						})
						instance[k] = new RSet(instances)
					})
				})
				return instances
			})
	}
	get(model, id) {
		let p = redis.pipeline()
		p.hgetall(model._key(id))
		_.each(model._info.sets, (k) => {
			p.smembers(model._key(id) + ':' + k)
		})
		return p.exec()
			.then(ret => _.map(ret, 1))
			.then(ret => {
				if (!ret[0] || _.isEmpty(ret[0]))
					return null
				let entity = _.head(ret)
				let sets = _.tail(ret)
				_.each(model._info.sets, (k, index) => {
					entity[k] = sets[index]
				})
				let m = this.init(model, entity)
				return this.fill(model, [m]).then(r => r[0])
			})
	}
	get_by(model, key, id) {
		return redis
			.get(model.ns + ':' + key + ':' + id)
			.then(id => id ? this.get(model, id) : null)
	}
	related_to(model, key, id, ascending = true, page) {
		let p
		let i = model._info
		if (i.indices.sortedk[key]) {
			let index = i.indices.sortedk[key]
			let start = page ? page.index : 0
			let end = page ? page.index + page.size : -1
			p = (!ascending ? redis.zrevrange : redis.zrange).bind(redis)(index.index_name(id), start, end)
		} else {
			let index = i.indices.unsortedk[key]
			p = redis.smembers(index.index_name(id))
		}
		return p.then(ids => this.many(model, ids, true))
	}
	many(model, id, fill = true) {
		let p = redis.pipeline()
		_.each(id, id => {
			p.hgetall(k(model, id))
			_.each(model._info.sets, key => {
				p.smembers(model._key(id) + ':' + key)
			})
		})
		return p.exec()
			.then((r) => _(r)
				.mapt(1)
				.chunk(1 + model._info.sets.length)
				.map(ret => {
					if (!ret[0] || _.isEmpty(ret[0]))
						return null
					let entity = _.head(ret)
					let sets = _.tail(ret)
					_.each(model._info.sets, (k, index) => {
						entity[k] = sets[index]
					})
					return this.init(model, entity)
				})
				.compact()
				.value())
			.then(instances => fill ? this.fill(model, instances) : instances)
	}
	all(model, index, reverse, page, size) {
		let p
		if (index) {
			let start = 0
			let end = -1
			if (page || page === 0) {
				page = page || 0
				size = size || 25
				start = page * size
				end = start + size
			}
			if (reverse)
				p = redis.zrevrange(model.ns + ':' + index, start, end)
			else
				p = redis.zrange(model.ns + ':' + index, start, end)
		} else
			p = redis.smembers(model.ns)
		return p
			.then(ids => this.many(model, ids))
	}
	save(instance) {
		let instances = Array.isArray(instance) ? instance : [instance]
		let p = redis.pipeline()
		_.each(instances, instance => {
			let info = instance.constructor._info
			let ns = instance.constructor.ns
			if (instance.version == 1) {
				p.sadd(ns, instance.id)
			}
			_.each(info.mapKeys, (b, property) => {
				p.set(ns + ':' + property  + ':' + instance[property], instance.id)
			})

			_.each(info.indices.unsorted, index => {
				if (!instance[index.property])
					return
				p.sadd(index.index_name(instance[index.property].id), instance.id)
			})

			_.each(info.indices.sorted, (index) => {
				if (_.isNil(instance[index.property]))
					return
				p.zadd(index.index_name(instance[index.property].id), index.sorted_by_date ? instance[index.sort_key].getTime() : instance[index.sort_key], instance.id)
			})
			_.each(info.sets, (key) => {
				(instance[key]).commit(instance._key + ':' + key, p)
			})

			_.each(info.indices.extended, (index) => {
				if (!instance[index.property])
					return
				_.each(index.index_extensions, extension => {
					let name = extension.name(instance)
					if (extension.sorted) {
						let sortValue = instance[extension.sort_key]
						if (extension.sorted_by_date)
							sortValue = sortValue.getTime()
						if (name[1])
							p.zrem(name[0], instance.id)
						else
							p.zadd(name[0], sortValue, instance.id)
					} else {
						if (name[1])
							p.srem(name[0], instance.id)
						else
							p.sadd(name[0], instance.id)
					}
				})
			})
			instance.version += 1
			instance.lastModified = new Date()
			let hmsetter = _.pick(instance, info.primitives)
			_.each(info.dates, (b, d) => (instance[d] ? (hmsetter[d] = instance[d].toISOString()) : undefined))
			_.each(info.jsons, (o) => (hmsetter[o] = JSON.stringify(instance[o])))
			_.each(info.primitiveModels, m => instance[m] ? (hmsetter[m] = instance[m].id || instance[m]) : undefined)
			p.hmset(k(instance.constructor, instance.id), hmsetter)
		})
		return p.exec()
			.then(() => undefined)
	}
	wipe(model) {
		if (model._info.indices.sorted.count || model._info.indices.unsorted.count)
			return this.all(model)
				.then(models => {
					let p = redis.pipeline()
					_.each(models, m => removeFromIndices(model._info, m, p) &&
					p.del(k(model, m.id))
					&& _.each(model._info.sets, s => p.del(setKey(model.ns, m.id, s))))
					p.del(model.ns)
					return p.exec()
				}).then(() => {return})
		return redis
			.smembers(model.ns)
			.then(ids => {
				let p = redis.pipeline()
				p.del(model.ns)
				_.each(ids, id => p.del(k(model, id)) && _.each(model._info.sets, s => p.del(setKey(model.ns, id, s))))
				return p.exec()
			}).then(() => {return})
	}
	delete(model, instance) {
		let p = redis.pipeline()
			.srem(model.ns, instance.id)
			.del(k(model, instance.id))

		removeFromIndices(model._info, instance, p)
		return p
			.exec()
			.then(() => {return})
	}
}
const removeFromIndices =(info, instance, p) => {
	_.each(info.indices.sorted, index => {
		if (!instance[index.property])
			return
		p.zrem(index.index_name(instance[index.property].id), instance.id)
	})
	_.each(info.indices.unsorted, index => {
		if (!instance[index.property])
			return
		p.srem(index.index_name(instance[index.property].id), instance.id)
	})
}
const setKey = (model, id, property) => {
	return `${model}:${id}:${property}`
}

module.exports = RedisORM
