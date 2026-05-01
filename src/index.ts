import "dotenv/config";
import { rmSync } from "fs";
import { resolve } from "path";

// annoying stupid ytsr dumps

rmSync(resolve("./node_modules/@distube/ytsr/dumps/"), {
    force: true,
    recursive: true
})

import Webserver from "./server/index.js";
import TemplateManager from "./manager/templateManager.js";
import ProviderManager from "./manager/providerManager.js";
import StatsManager from "./manager/statsManager.js";
import ClientManager from "./manager/clientManager.js";
import Database from "./database/index.js";
import ImageManager from "./database/imageManager.js";

export const database = new Database()

export const server = new Webserver();

await database.init()

server.start();
TemplateManager.loadTemplates();
ClientManager.init();
ProviderManager.loadProviders();
StatsManager.init();
ImageManager.init()


export function setMaintenanceMode(mode: boolean) {
    if (mode) {
        console.log("Maintenance mode enabled");
    } else {
        console.log("Maintenance mode disabled");
    }
    maintenanceMode = mode;
}

export var maintenanceMode = process.env.MAINTENANCE_MODE === "true" || false;
