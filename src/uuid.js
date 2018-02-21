const short = require('short-uuid')

const flickrTranslator = short(short.constants.flickrBase58)

module.exports = () => flickrTranslator.uuid()
