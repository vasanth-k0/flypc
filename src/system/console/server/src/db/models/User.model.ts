import { DataTypes, Model, Sequelize } from 'sequelize'

export type UserRole = 'Admin' | 'Guest'

export interface UserAttributes {
  id: string
  username: string
  password: string
  role: UserRole
  createdAt?: Date
  updatedAt?: Date
}

export interface UserCreationAttributes {
  username: string
  password: string
  role?: UserRole
}

export class UserModel extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  declare id: string
  declare username: string
  declare password: string
  declare role: UserRole
  declare readonly createdAt: Date
  declare readonly updatedAt: Date
}

export const initUserModel = (sequelize: Sequelize): typeof UserModel => {
  UserModel.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
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
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'Users',
    }
  )

  return UserModel
}
