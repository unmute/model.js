
const HashSet = require('../src/HashSet')

describe('HashSet', function() {
	describe('constructor', function() {
		it('should have objects field as an object', function() {
			let it = new HashSet()
  		it.objects.should.be.an('object')
		})
	})
	describe('add', function() {
		it('should add value to objects', function() {
			let it = new HashSet()
			it.add('hi')
			it.objects.should.have.key('hi')
			it.objects.hi.should.equal('hi')
		})
		it('(IDABLE) should add value to objects by id', function() {
			let it = new HashSet()
			let put = {'id':'hi'}
			it.add(put)
			it.objects.should.have.key(put.id)
			it.objects[put.id].should.equal(put)
		})
		it('should add varargs of values', function() {
			let it = new HashSet()
			it.add('hi', 'bye')
			it.objects.should.have.keys('hi', 'bye')
			it.objects.hi.should.equal('hi')
			it.objects.bye.should.equal('bye')
		})
		it('(IDABLE) should add varargs', function() {
			let it = new HashSet()
			let put1 = {'id':'hi'}
			let put2 = {'id': 'bye'}
			it.add(put1, put2)
			it.objects.should.have.keys(put1.id, put2.id)
			it.objects[put1.id].should.equal(put1)
			it.objects[put2.id].should.equal(put2)
		})
	})
	describe('has', function() {
		it('should have added value', function() {
			let it = new HashSet()
			it.add('hi')
			it.has('hi').should.equal(true)
			let put = {id:'hi'}
			it.add(put)
			it.has('hi').should.equal(true)
		})
	})
	describe('delete', function() {
		it('should remove value', function() {
			let it = new HashSet()
			it.add('hi')
			it.delete('hi')
			it.has('hi').should.equal(false)
			let put = {id:'hi'}
			it.add(put)
			it.delete(put)
			it.has('hi').should.equal(false)
		})
	})
	describe('map', function() {
		it('should map values', function() {
			let it = new HashSet()
			let put1 = {id:'hi'}
			let put2 = {id:'bye'}
			it.add(put1, put2)
			let mres = it.map((put) => put.id)
			mres.should.have.members(['hi', 'bye'])
		})
	})
	describe('array', function() {
		it('should ret array', function() {
			let it = new HashSet()
			let put1 = {id:'hi'}
			let put2 = {id:'bye'}
			it.add(put1, put2)
			let mres = it.array
			mres.should.have.members([put1, put2])
		})
	})
	describe('clear', function() {
		it('should be empty', function() {
			let it = new HashSet()
			let put1 = {id:'hi'}
			let put2 = {id:'bye'}
			it.add(put1, put2)
			it.clear()
			it.objects.should.be.empty
		})
	})
	describe('forEach', function() {
		it('should loop all', function() {
			let eacha = []
			let it = new HashSet()
			let put1 = {id:'hi'}
			let put2 = {id:'bye'}
			it.add(put1, put2)
			it.forEach((put) => eacha.push(put))
			eacha.should.have.members([put1, put2])
		})
	})
	describe('entries', function() {
		it('should have all', function() {
			let it = new HashSet()
			let put1 = {id:'hi'}
			let put2 = {id:'bye'}
			it.add(put1, put2)
			it.entries().should.have.members([put1, put2])
		})
	})
	describe('size', function() {
		it('should return count of members', function() {
			let it = new HashSet()
			it.size.should.equal(0)
			let put1 = {id:'hi'}
			let put2 = {id:'bye'}
			it.add(put1, put2)
			it.size.should.equal(2)
			it.delete(put1)
			it.size.should.equal(1)
		})
	})
	describe('iterator', function() {
		it('should iterate all members', function() {
			let eacha = []
			let it = new HashSet()
			let put1 = {id:'hi'}
			let put2 = {id:'bye'}
			it.add(put1, put2)
			for (let put of it) {
				eacha.push(put)
			}
			eacha.should.have.members([put1, put2])
		})
	})
	describe('toJSON()', function() {
		it('should return array of values', function() {
			let it = new HashSet()
			let put1 = {id:'hi'}
			let put2 = {id:'bye'}
			it.add(put1, put2)
			it.toJSON().should.have.members([put1, put2])
		})
	})
})
