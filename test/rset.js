const RSet = require('../src/RSet')

describe('RSet', function() {
	describe('add', function() {
		it('should include add in changeset', function() {
			let it = new RSet()
  		let put = {id: 'hi'}
  		it.add(put)
  		it._changes.adds[put.id].should.equal(true)
		})
	})
	describe('delete', function() {
		it('should include delete in changeset', function() {
			let put = {id: 'hi'}
			let it = new RSet(put)
			it.delete(put)
			it._changes.removes[put.id].should.equal(true)
		})
	})
})
