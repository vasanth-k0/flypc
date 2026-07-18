import type { QueryInterface } from 'sequelize'
import { DataTypes } from 'sequelize'

export const up = async ({ context }: { context: QueryInterface }): Promise<void> => {
  await context.createTable('Users', {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.STRING(16),
      allowNull: false,
      defaultValue: 'Guest',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  })
}

export const down = async ({ context }: { context: QueryInterface }): Promise<void> => {
  await context.dropTable('Users')
}
