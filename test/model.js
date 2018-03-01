
const Model = require('../src/Model')
const Redis = require('ioredis')
const redis = new Redis()
const _ = require('lodash')


describe('Model', function() {
	describe('Model.setDB', function() {
		it('should create orm and set db to passed in db', function() {
			Model.setDB(redis)
			Model.getORM().getDB().should.equal(redis)
		})
	})
	let newModelSchema = {
		name: Model.Types.String,
		date: Model.Types.Date,
		age: Model.Types.Int,
		balance: Model.Types.Float
	}
	class NewModel extends Model {
		static get schema() {
			return newModelSchema
		}
	}
	let newModelRelSchema = {
		name: Model.Types.String,
		new_model: {
			type: NewModel,
			index: true,
			required: true
		},
		new_models: {
			type: [ Model.Types.Set, NewModel],
			required: true
		}
	}
	class NewModelRel extends Model {
		static get schema() {
			return newModelRelSchema
		}
	}
	describe('class extends Model & new', function() {

		it('new instance should have .id, .createdAt, .lastModified, .version', function() {
			let m = new NewModel()
			m.id.should.be.a('string')
			m.id.should.not.be.empty
			m.createdAt.should.be.a('date')
			m.lastModified.should.be.a('date')
			m.version.should.be.a('number')
		})
	})
	describe('save', function() {
		it('Save new model with defined properties to redis as hashmap', function() {
			let m = new NewModel()
			m.name = 'test1'
			m.date = new Date(Date.now() - 1000 * 24 * 60 * 5)
			m.age = 25
			m.balance = 1.37432
			return m.save()
				.then(() => redis
					.hgetall('newmodels:' + m.id)
					.then(data => {
						data.name.should.equal(m.name)
						data.date.should.equal(m.date.toISOString())
						data.age.should.equal(m.age.toString())
						data.balance.should.equal(m.balance.toString())
					}))
		})
		it('Add new model to list of models when saving', function() {
			let m = new NewModel()
			m.name = 'test2'
			return m.save()
				.then(() => {
					return redis.sismember('newmodels', m.id)
						.then(res => {
							res.should.equal(1)
						})
				})
		})
		it('should save one to one relationship ids when saving', function() {
			let m = new NewModel()
			m.name = 'test3'
			return m.save()
				.then(() => {
					let m2 = new NewModelRel()
					m2.name = 'test4'
					m2.new_model = m
					return m2.save()
						.then(() => {
							return redis.hgetall('newmodelrels:'  + m2.id)
								.then(data => {
									data.new_model.should.equal(m.id)
								})
						})
				})
		})
		it('should save one to many relationship ids when saving', function() {
			let m = new NewModel()
			let m2 = new NewModel()
			return NewModel.save([m, m2])
				.then(() => {
					let m3 = new NewModelRel()
					m3.new_models.add(m)
					m3.new_models.add(m2)
					return m3.save()
						.then(() => {
							return redis.smembers('newmodelrels:' + m3.id + ':new_models')
								.then(ids => {
									ids.should.include(m.id)
									ids.should.include(m2.id)
								})
						})
				})
		})
	})
	describe('Model.save', function() {
		it('should save all passed models', function() {
			let m = new NewModel()
			m.name = 'test21'
			let m2 = new NewModel()
			m2.name = 'test23'
			return NewModel.save([m, m2])
				.then(() => {
					return redis.pipeline()
						.hgetall('newmodels:' + m.id)
						.hgetall('newmodels:' + m2.id)
						.exec()
						.then(res => _.map(res, 1))
						.then(res => {
							let ids = _.map(res, 'id')
							ids.should.include(m.id)
							ids.should.include(m2.id)
							let names = _.map(res, 'name')
							names.should.include(m.name)
							names.should.include(m2.name)
						})
				})
		})
	})
	describe('Model.all', function() {
		it('should retrieve all saved models', function() {
			let m = new NewModel()
			m.name = 'test723'
			let m2 = new NewModel()
			m2.name = '2137'
			return NewModel.save([m, m2])
				.then(() => {
					return NewModel.all()
						.then(models => {
							let ids = _.map(models, 'id')
							ids.should.include(m.id)
							ids.should.include(m2.id)
							let names = _.map(models, 'name')
							names.should.include(m.name)
							names.should.include(m2.name)
						})
				})
		})
	})
	describe('Model.get', function() {
		it('should retrieve a model by id', function() {
			let m = new NewModel()
			m.name = 'somethingrandom'
			return m.save()
				.then(() => NewModel.get(m.id))
				.then(model => {
					model.id.should.equal(m.id)
					model.name.should.equal(m.name)
				})
		})
	})
	// describe('Model.related_to', function() {
	// 	it('should retrieve models in a one to many relationship', function() {
	// 		let m = new NewModel()
	// 		m.name = 'it'
	// 		return m.save()
	// 			.then(() => {
	// 				let m3 = new NewModelRel()
	// 				m3.new_model = m
	// 				let m2 = new NewModelRel()
	// 				m2.new_model = m
	// 				return NewModelRel.save([m2, m3])
	// 					.then(() => {
	// 						return NewModelRel.related_to(m.id, 'new_model')
	// 							.then(models => {
	// 								let ids = _.map(models, 'id')
	// 								ids.should.include(m.id)
	// 								ids.should.include(m2.id)
	// 								let names = _.map(models, 'name')
	// 								names.should.include(m.name)
	// 								names.should.include(m2.name)
	// 							})
	// 					})
	// 			})
	// 	})
	// })
})
