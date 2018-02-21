A redis ORM for nodejs using ioredis

Example:
```
const Redis = require('ioredis')
const Model = require('model.js')

const redis = new Redis()
Model.setDB(redis)


class User extends Model {
  static get schema() {
    return userSchema
  }
}

const userSchema = {
  name: Model.Types.String,
  age: Model.Types.Int,
  birthday: Model.Types.Date,
  friends: [Model.Types.Set, User]
}

let me = new User()
me.name = "z"
me.save()
  .then(me => {
    let friend = new User()
    friend.name = "pookie"
    friend.save()
    me.friends.add(friend)
    me.save()
    })
```
