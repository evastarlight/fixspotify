import { MikroORM, PostgreSqlDriver, EntityManager } from "@mikro-orm/postgresql";
import { TsMorphMetadataProvider } from "@mikro-orm/reflection";

export default class Database {
  private _orm!: MikroORM;
  private _em!: EntityManager<PostgreSqlDriver>;

  constructor() {
    this.init();
  }

  public async init(): Promise<void> {
    const orm = await MikroORM.init<PostgreSqlDriver>({
      entities: ["./dist/database/entities/*.js"],
      driver: PostgreSqlDriver,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      dbName: process.env.DB_NAME,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5432,
      metadataProvider: TsMorphMetadataProvider,
    }).catch((err) => {
      console.error(err);
      process.exit(1);
    });

    this._orm = orm;
    this._em = orm.em;

  }

  public async close(): Promise<void> {
    await this._orm.close(true);
  }

  public get em(): EntityManager<PostgreSqlDriver> {
    return this._em.fork();
  }

  public get orm(): MikroORM {
    return this._orm;
  }


}
