import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('warehouse_info', function (table) {
        table.increments('id').primary();
        table.string('dtNextBox');
        table.string('dtTillMax');
        table.string('dtAdd').notNullable();
    });

    await knex.schema.createTable('warehouses', function (table) {
        table.increments('id').primary();
        table.integer('warehouse_info_id').unsigned().references('id').inTable('warehouse_info').onDelete('CASCADE');
        table.string('warehouseName').notNullable();
        table.string('boxDeliveryAndStorageExpr').notNullable();
        table.string('boxDeliveryBase').notNullable();
        table.string('boxDeliveryLiter').notNullable();
        table.string('boxStorageBase').notNullable();
        table.string('boxStorageLiter').notNullable();
    });
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('warehouses');
    await knex.schema.dropTableIfExists('warehouse_info');
}