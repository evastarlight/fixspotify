import { defineEntity, p } from "@mikro-orm/core"
import id from "../../util/id.js"

export const ResourceSchema = defineEntity({
    name: "resource",
    abstract: true,
    properties: {
        id: p.string().primary().default(id()),
        createdAt: p.datetime().onCreate(() => new Date()),
        updatedAt: p.datetime().onCreate(() => new Date()).onUpdate(() => new Date()),
    }
})