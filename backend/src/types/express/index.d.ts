declare namespace Express {
  export interface Request {
    version: string;
    user?: any;
  }
}