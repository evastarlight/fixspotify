export class AppError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  readonly resource: string;
  readonly id: string;

  constructor(resource: string, id: string, options?: ErrorOptions) {
    super(`${resource} not found: ${id}`, options);
    this.resource = resource;
    this.id = id;
  }
}

export class BadRequestError extends AppError {}

export class UpstreamError extends AppError {
  readonly service: string;
  readonly status: number;
  readonly retryAfterSeconds: number | undefined;

  constructor(
    service: string,
    status: number,
    options?: ErrorOptions & { retryAfterSeconds?: number | undefined },
  ) {
    super(`${service} responded ${status}`, options);
    this.service = service;
    this.status = status;
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}
