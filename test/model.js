
const Model = require('../src/Model')
const Redis = require('ioredis')
const redis = new Redis()


describe('Model', function() {
	describe('Model.setDB', function() {
		it('should create orm and set db to passed in db', function() {
			Model.setDB(redis)
			Model.getORM().getDB().should.equal(redis)
		})
	})
})
