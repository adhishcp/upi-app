export interface User {
  id: string;  
  name: string;
  email: string;
  password: string;
  mobile: string;
  vpa: string;
  createdAt: Date;
}

export type UserWithoutPassword = Omit<User, 'password'>;
