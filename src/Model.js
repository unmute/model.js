//
const RSet = require('./orm/RSet')
const RedisORM = require('./orm/redis')
const pluralize = require('pluralize')
const uuid = require('uuid').v4
const shortid = require('shortid')
const _ = require('lodash')
const Types = require('./types')
let orm = new RedisORM()

let schema = {
	id: {
		type: Types.String,
		default: uuid
	},
	sid: {
		type: Types.String,
		default: () => shortid.generate(),
		map: true
	},
	createdAt: {
		type: Types.Date,
		default: () => new Date()
	},
	lastModified: {
		type: Types.Date,
		default: () => new Date()
	},
	version: {
		type: Types.Date,
		hidden: true,
		default: _.constant(1)
	}
}

class Model extends Object {

	constructor(p) {
		super()
		_.assign(this, p)
		_.each(this.constructor._info.defaults, (f, k) => {
			if (this[k] === undefined)
				this[k] = f()
		})
		_.each(this.constructor._info.sets, (k) => {
			this[k] = new RSet(this[k])
		})
		this.transient = {}
	}
	static get Types() {
		return Types
	}
	static get schema() {
		return schema
	}
	static get(id) {
		return orm.get(this, id)
	}
	static get_by(key, id) {
		return orm.get_by(this, key, id)
	}
	static related_to(key, id, ascending = true, page) {
		return orm.related_to(this, key, id, ascending, page)
	}
	static many(ids) {
		return orm.many(this, ids)
	}
	static all(index, reverse, page, size) {
		return orm.all(this, index, reverse, page, size)
	}
	save() {
		return orm.save(this).then(() => this)
	}
	static save(instances) {
		return orm.save(instances)
	}
	delete() {
		return orm.delete(this.constructor, this)
	}
	static wipe() {
		return orm.wipe(this)
	}
	static get ns() {
		return this.__ns || (this.__ns = pluralize(this.name.toLowerCase()))
	}
	static get __key() {
		return this.ns + ':'
	}
	static _key(id) {
		return this.__key + id
	}
	get _key() {
		return this.constructor.__key + this.id
	}
	static get _info() {
		return parseSchema(this)
	}
	toJSON() {
		let i = this.constructor._info
		let ret = {}
		_.each(this, (v, k) => {
			if (i.hiddens[k])
				return
			if (v !== undefined && v !== null)
				ret[i.json_mappings[k] || k] = v
		})
		_.assign(ret, this.transient)
		return ret
	}
}


function default_for_type(type){
	if (type === Types.Date) {
		return null
	} else if (type === Types.String) {
		return _.constant(null)
	} else if (type === Types.Number) {
		return _.constant(0)
	} else if (type === Types.Boolean) {
		return _.constant(false)
	} else if (Model.isPrototypeOf(type)) {
		return _.constant(null)
	} else if (Array.isArray(type) && type[0] === Types.Set) {
		return () => new RSet()
	} else {
		return () => []
	}
}






const parseSchema =(model) => {
	if (cache[model.ns])
		return cache[model.ns]

	let rels =  {}
	let requiredRels = {}
	let hiddens = {transient: true}
	let dates = {}
	let primitives = []
	let jsons = []
	let schema = _.assign(model.schema, Model.schema)
	let mapKeys = {}
	let indices = []
	let sets = []
	let arrays = []
	let primitiveModels = []
	let defaults = {}
	let json_mappings = {}
	let model_rels = {}
	let set_rels = {}
	let array_rels = {}
	_.each(schema, (t, p) => {
		let type = t.type ? t.type : t
		let def = t.default || default_for_type(type)
		if (def)
			defaults[p] = def

		if (type === Types.Date) {
			dates[p] = true
		} else if (type === Types.JSON) {
			jsons.push(p)
		} else if (Model.isPrototypeOf(type)) {
			primitiveModels.push(p)
			model_rels[p] = (type)
			rels[p] = (type)
			if (t.required === true)
				requiredRels[p] = (type)
		} else if (Array.isArray(type)) {
			if (type[0] === Types.Set) {
				sets.push(p)
				if (Model.isPrototypeOf(type[1])) {
					set_rels[p] = type[1]
					rels[p] = (type)
					if (t.required === true)
						requiredRels[p] = (type)
				}
			} else {
				arrays.push(p)
				if (Model.isPrototypeOf(type[1])) {
					array_rels[p] = type[1]
					rels[p] = (type)
					if (t.required === true)
						requiredRels[p] = (type)
				}
			}
		} else {
			primitives.push(p)
		}

		if (t.hidden === true)
			hiddens[p] = true
		if (t.map === true)
			mapKeys[p] = true
		if (t.json_mapping)
			json_mappings[p] = t.json_mapping

		if (t.index === true) {
			const makeIndex = (p, n) => {
				return (id) => `${p}:${id}:${n}`
			}

			//$FlowFixMe
			let index_name = Model.isPrototypeOf(type) ? makeIndex(type.ns, t.index_name || model.ns) : () => `${model.ns}:${t.index_name || p}`
			if (!Model.isPrototypeOf(type) && !Model.isPrototypeOf(type[1]) && !t.sorted && !t.sort_key) {
				t.sorted = true
				t.sort_key = p
			}
			/*
			properties:[
				{property:'country', by_bin:(country: String) => Call.worlds[country]},
				{property:'state', by_value:'live', name:'live'},
				{property:'privacy', by_check:(value: Privacy) => value != 'private', name:'public'}
			],
			*/
			let index_extensions = _.map(t.indices || [], extension => {
				let name = (el) => {
					let isRemoved = false
					let pkeys = _.map(extension.properties, property => {
						if (property.by_bin) {
							return property.by_bin(el[property.property])
						} else if (property.by_check) {
							if (property.by_check(el[property.property])) {
								return property.name || property.property
							} else {
								isRemoved = true
								return property.name || property.property
							}
						} else if (property.name) {
							return property.name
						}
						return property.property
					})
					return [index_name(el[p].id) + ':' + pkeys.join(), isRemoved]
				}
				let sort_property = schema[extension.sort_key || 'createdAt']

				let sort_type = sort_property.type || sort_property
				return {
					name,
					sorted: extension.sorted || false,
					sort_key: extension.sort_key || 'createdAt',
					sorted_by_date: sort_type === Date
				}
			})
			let sort_key = t.sort_key || 'createdAt'
			let sort_property = schema[sort_key]
			let sort_type = sort_property.type || sort_property

			let i = {
				property:p,
				index_name,
				sorted: t.sorted || false,
				sort_key: sort_key,
				sorted_by_date: sort_type === Date,
				index_extensions,
			}
			if (Array.isArray(type) && Model.isPrototypeOf(type[1])) {
				i.type = type[1]
			}
			indices.push(i)
		}
	})
	let json_mappings_inverted = {}
	_.each(json_mappings, (v, k) => {
		json_mappings_inverted[v] = (k)
	})
	let schema_keys = {}
	_.each(schema, (v, k) => {
		schema_keys[k] = true
	})
	let ret = {
		name:model.name.toLowerCase(),
		name_plural:model.ns,
		schema,
		schema_keys,
		defaults,
		relationships:rels,
		model_rels,
		set_rels,
		array_rels,
		requiredRelationships:requiredRels,
		hiddens,
		json_mappings,
		json_mappings_inverted,
		dates,
		mapKeys,
		indices:{
			unsorted: _.reject(indices, 'sorted'),
			sorted: _.filter(indices, 'sorted'),
			unsortedk: _.keyBy(_.reject(indices, 'sorted'), 'property'),
			sortedk: _.keyBy(_.filter(indices, 'sorted'), 'property'),
			extended: _.filter(indices, index => index.index_extensions.length > 0)
		},
		primitives,
		jsons,
		sets,
		primitiveModels
	}
	cache[model.ns] = ret
	return ret
}

const cache = {}

module.exports = Model
