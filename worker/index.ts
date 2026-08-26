import { handleRequest } from "./app";

export { Stats } from "./stats";

export default { fetch: handleRequest } satisfies ExportedHandler<Env>;
