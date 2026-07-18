import bcrypt from 'bcrypt'
import type { QueryInterface } from 'sequelize'
import { QueryTypes } from 'sequelize'
import { randomUUID } from 'node:crypto'

export const up = async ({ context }: { context: QueryInterface }): Promise<void> => {
  const existing = (await context.sequelize.query(
    'SELECT id FROM Users WHERE username = :username LIMIT 1',
    {
      replacements: { username: 'admin' },
      type: QueryTypes.SELECT,
    }
  )) as Array<{ id: string }>

  if (existing.length > 0) {
    return
  }

  const password = await bcrypt.hash('Admin@123', 10)
  const now = new Date()

  await context.bulkInsert('Users', [
    {
      id: randomUUID(),
      username: 'admin',
      password,
      role: 'Admin',
      createdAt: now,
      updatedAt: now,
    },
  ])
}

export const down = async ({ context }: { context: QueryInterface }): Promise<void> => {
  await context.bulkDelete('Users', { username: 'admin' })
}
