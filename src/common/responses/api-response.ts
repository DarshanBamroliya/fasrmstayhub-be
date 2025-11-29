export class ApiResponse<T> {
  error: boolean;
  msg: string;
  data: T | null;
  token?: string;

  constructor(error: boolean, msg: string, data: T | null = null, token?: string) {
    this.error = error;
    this.msg = msg;
    this.data = data;
    this.token = token;
  }
}
