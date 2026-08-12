import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Sequelize } from 'sequelize'
import { Umzug, SequelizeStorage } from 'umzug'
import { initUserModel, UserModel } from './models/User.model.js'
import { initNotificationModel } from './models/Notification.model.js'
import { ensureBlueprintFile, ensureUserPreferencesFromBlueprint } from '../controllers/TenantStorage.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const sqliteStoragePath =
  process.env.SQLITE_STORAGE ?? path.resolve(__dirname, 'store', 'database.sqlite')

fs.mkdirSync(path.dirname(sqliteStoragePath), { recursive: true })

export const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: sqliteStoragePath,
  logging: false,
})

initUserModel(sequelize)
initNotificationModel(sequelize)

const migrationGlob = path.resolve(__dirname, 'migrations/!(*.d).{js,ts}')

export const umzug = new Umzug({
  migrations: {
    glob: migrationGlob,
    resolve: ({ name, path: migrationPath, context }) => {
      if (!migrationPath) {
        throw new Error(`Unable to resolve migration: ${name}`)
      }

      return {
        name,
        up: async () => {
          const module = (await import(pathToFileURL(migrationPath).href)) as {
            up: (params: { context: unknown }) => Promise<void>
          }
          await module.up({ context })
        },
        down: async () => {
          const module = (await import(pathToFileURL(migrationPath).href)) as {
            down: (params: { context: unknown }) => Promise<void>
          }
          await module.down({ context })
        },
      }
    },
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: console,
})

let initialized = false

export const initializeDatabase = async (): Promise<void> => {
  if (initialized) {
    return
  }

  ensureBlueprintFile()

  await sequelize.authenticate()
  await umzug.up()

  const users = await UserModel.findAll({ attributes: ['username'] })
  for (const user of users) {
    ensureUserPreferencesFromBlueprint(user.username)
  }

  initialized = true
}
