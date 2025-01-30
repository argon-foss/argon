export interface User {
  id: string;
  username: string;
  password: string; // hashed!
  permissions: string[]; // Array of permission strings
}

export interface AuthResponse {
  token: string;
  permissions: string[];
}

export interface StateResponse {
  authenticated: boolean;
  username: string;
  permissions: string[];
}