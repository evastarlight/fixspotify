export class AppError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`);
  }
}

export class BadRequestError extends AppError {}

export class UpstreamError extends AppError {
  readonly status: number;
  readonly retryAfterSeconds: number | undefined;

  constructor(service: string, status: number, retryAfterSeconds?: number) {
    super(`${service} responded ${status}`);
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
