//
const _ = require('lodash')
const HashSet = require('./HashSet')

class RSet extends HashSet {
	constructor(object) {
		super()
		this._changes = {
			adds:{},
			removes:{}
		}
		if (Array.isArray(object)) {
			this.add.apply(this, object)
		} else if (object instanceof HashSet) {
			this.add(...object.entries())
		} else if (object){
			this.add(object)
		}
	}
	add(...elements) {
		super.add.apply(this, elements)
		_.each(elements, el => {
			let k = this._key(el)
			this._changes.adds[k] = true
			delete this._changes.removes[k]
		})
	}
	delete(el) {
		if (super.delete(el)) {
			let k = this._key(el)
			this._changes.removes[k] = true
			delete this._changes.adds[k]
			return true
		}
		return false
	}
	commit(key, pipe) {
		if (!_.isEmpty(this._changes.adds))
			pipe.sadd(key, ..._.keys(this._changes.adds))
		if (!_.isEmpty(this._changes.removes))
			pipe.srem(key, ..._.keys(this._changes.removes))
		this._changes = {
			adds:{},
			removes:{}
		}
		return pipe
	}
	clear() {
		let ids = _.keys(this.objects)
		super.clear()
		this._changes.adds = {}
		_.each(ids, id => this._changes.removes[id] = true)
	}
}

module.exports = RSet
