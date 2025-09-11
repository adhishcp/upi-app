import { Role } from ".prisma/client";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  mobile: string;
  vpa: string;
  role: Role,
  createdAt: Date;
}

export type UserWithoutPassword = Omit<User, 'password'>;
