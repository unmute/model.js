'use strict'
//
const _ = require('lodash')
//------- end imports --------

/**
* SetLike implementation
*/
class HashSet {
	/*:: @@iterator(): Iterator<T> { return ({}: any); } */
	constructor(object) {
		this.objects = { }
		if (Array.isArray(object)) {
			this.add.apply(this, object)
		} else if (object instanceof HashSet) {
			this.add(...object.entries())
		} else if (object){
			this.add(object)
		}
	}

	add(...objects) {
		_.each(objects, o => {
			this.objects[this._key(o)] = o
		})
	}

	has(object) {
		return !!this.objects[this._key(object)]
	}
	_key(object) {
		if (typeof object == 'string')
			return object
		else
			return object.id
	}
	delete(object) {
		let k = this._key(object)
		if (this.objects[k]) {
			delete this.objects[k]
			return true
		}
		return false
	}

	map(func) {
		return _.map(this.objects, func)
	}

	get array() {
		return _.values(this.objects)
	}

	clear() {
		this.objects = { }
	}

	forEach(func) {
		_.each(this.entries(), func)
	}

	each(func) {
		_.each(this.entries(), func)
	}

	entries() {
		return _.values(this.objects)
	}

	get size() {
		return _.size(this.objects)
	}

	// $FlowFixMe: computed property
	[Symbol.iterator]() {
		let index = 0
		let keys = Object.keys(this.objects)
		return {
			next:() => {
				return (index < keys.length) ? {value: this.objects[keys[index++]], done: false} : { done: true }
			}
		}
	}
	toJSON() {
		return this.array
	}
}

module.exports = HashSet
