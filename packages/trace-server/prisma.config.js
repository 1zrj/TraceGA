require('dotenv/config')

/** @type {import('prisma').Config} */
module.exports = {
  datasource: {
    url: process.env.DATABASE_URL || 'mysql://root:root@localhost:3306/tracega',
  },
}
