import axios from "axios";
import knexConfig from '../config/knexfile';
import knex from 'knex';
import { google } from 'googleapis';
import path from 'path';

interface WarehouseData {
    warehouseName: string;
    boxDeliveryAndStorageExpr: string;
    boxDeliveryBase: string;
    boxDeliveryLiter: string;
    boxStorageBase: string;
    boxStorageLiter: string;
}

interface ResponseData {
    response: {
        data: {
            dtAdd: string;
            dtNextBox: string;
            dtTillMax: string;
            warehouseList: WarehouseData[];
        }
    };
}

export async function fetchDataAndSave(): Promise<void> {
    const url = process.env.URL_WB;
    const token = process.env.TOKEN_WB;
    const queryParam = new Date().toISOString().split('T')[0];

    try {
        const result = await axios.get(url as string, {
            headers: {
                Authorization: `Bearer ${token}`
            },
            params: {
                date: queryParam
            }
        })
        if (result.data) {
            await addWarehouseData(result.data, queryParam)
        }

    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            if (error.response && error.response.status === 429) {
                console.log('Получен код ошибки 429. Ожидаем 1 минуту и повторяем запрос...');
                setTimeout(async () => {
                    await fetchDataAndSave();
                }, 60000);
            } else {
                console.log('Ошибка при получении данных:', error.response?.data || error.message);
            }
        } else {
            console.error('Неизвестная ошибка:', error);
        }
    }
}

async function addWarehouseData(data: ResponseData, queryParam: string): Promise<void> {
    const db = knex(knexConfig);
    await db.transaction(async (trx) => {
        try {
            const { dtNextBox, dtTillMax } = data.response.data;
            const warehouseList = data.response.data.warehouseList;

            const existingWarehouseInfo = await trx('warehouse_info')
                .where('dtAdd', queryParam)
                .first();

            let warehouseInfoId: number;

            if (existingWarehouseInfo) {
                warehouseInfoId = existingWarehouseInfo.id;
                await trx('warehouse_info')
                    .where('id', warehouseInfoId)
                    .update({
                        dtNextBox: dtNextBox,
                        dtTillMax: dtTillMax
                    });
            } else {
                const [newWarehouseInfoId] = await trx('warehouse_info')
                    .insert({
                        dtAdd: queryParam,
                        dtNextBox: dtNextBox,
                        dtTillMax: dtTillMax
                    })
                    .returning('id');
                warehouseInfoId = newWarehouseInfoId.id;
            }

            for (let warehouse of warehouseList) {
                const existingWarehouse = await trx('warehouses')
                    .where('warehouse_info_id', warehouseInfoId)
                    .andWhere('warehouseName', warehouse.warehouseName)
                    .first();

                if (existingWarehouse) {
                    await trx('warehouses')
                        .where('id', existingWarehouse.id)
                        .update({
                            boxDeliveryAndStorageExpr: warehouse.boxDeliveryAndStorageExpr,
                            boxDeliveryBase: warehouse.boxDeliveryBase,
                            boxDeliveryLiter: warehouse.boxDeliveryLiter,
                            boxStorageBase: warehouse.boxStorageBase,
                            boxStorageLiter: warehouse.boxStorageLiter
                        });
                } else {
                    await trx('warehouses')
                        .insert({
                            warehouse_info_id: warehouseInfoId,
                            warehouseName: warehouse.warehouseName,
                            boxDeliveryAndStorageExpr: warehouse.boxDeliveryAndStorageExpr,
                            boxDeliveryBase: warehouse.boxDeliveryBase,
                            boxDeliveryLiter: warehouse.boxDeliveryLiter,
                            boxStorageBase: warehouse.boxStorageBase,
                            boxStorageLiter: warehouse.boxStorageLiter
                        });
                }
            }
            console.log('Данные обновлены/добавлены успешно');
        } catch (error) {
            console.error('Ошибка при обновлении данных:', error);
            throw error;
        }
    });
}

export async function exportToGoogle() {
    const spreadsheetId = process.env.SPREAD_SHEET_ID?.split(',');

    if (spreadsheetId === undefined) {
        console.error('SPREAD_SHEET_ID is not defined');
        return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const sheetTitle = yesterday.toISOString().split('T')[0];

    const data = await getSortedWarehouseData(sheetTitle);

    for (const element of spreadsheetId) {
        await updateGoogleSheet(element, data, sheetTitle);
    }
}

async function getSortedWarehouseData(sheetTitle: string) {
    const db = knex(knexConfig);
    try {
        const data = await db('warehouses')
            .join('warehouse_info', 'warehouses.warehouse_info_id', '=', 'warehouse_info.id')
            .select(
                'warehouses.id',
                'warehouses.warehouseName',
                'warehouses.boxDeliveryAndStorageExpr',
                'warehouses.boxDeliveryBase',
                'warehouses.boxDeliveryLiter',
                'warehouses.boxStorageBase',
                'warehouses.boxStorageLiter',
                'warehouse_info.dtNextBox',
                'warehouse_info.dtTillMax',
                'warehouse_info.dtAdd'
            )
            .where('warehouse_info.dtAdd', '=', sheetTitle)
            .orderBy('warehouses.boxDeliveryAndStorageExpr', 'asc');

        return data;
    } catch (error) {
        console.error('Ошибка при запросе данных:', error);
        throw error;
    }
}

async function updateGoogleSheet(spreadsheetId: string, data: any[], sheetTitle: string) {
    const auth = new google.auth.GoogleAuth({
        keyFile: path.join(__dirname, '..', '..', 'credentials.json'),
        scopes: 'https://www.googleapis.com/auth/spreadsheets',
    });
    const client = await auth.getClient();

    const googleSheets = google.sheets({
        version: 'v4',
        auth: client as any
    });

    const header = [
        'ID', 'Warehouse Name', 'Box Delivery and Storage Expr', 'Box Delivery Base',
        'Box Delivery Liter', 'Box Storage Base', 'Box Storage Liter', 'Next Box Date', 'Till Max Date'
    ];

    const rows = data.map(item => [
        item.id,
        item.warehouseName,
        item.boxDeliveryAndStorageExpr,
        item.boxDeliveryBase,
        item.boxDeliveryLiter,
        item.boxStorageBase,
        item.boxStorageLiter,
        item.dtNextBox,
        item.dtTillMax
    ]);

    try {
        await googleSheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: {
                requests: [
                    {
                        addSheet: {
                            properties: {
                                title: sheetTitle,
                                gridProperties: {
                                    rowCount: 1000,
                                    columnCount: 26,
                                },
                            },
                        },
                    },
                ],
            },
        });

        const values = [header, ...rows];

        await googleSheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetTitle}!A1`,
            valueInputOption: 'RAW',
            requestBody: { values }
        });

        console.log(`Данные успешно выгружены в Google Sheets для таблицы ${spreadsheetId}`);
    } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status && err.response.status >= 400 && err.response.status < 500) {
            console.warn(`Ошибка ${err.response.status}: Данные не выгружены в Google Sheets для таблицы ${spreadsheetId}`);

            if (err.response.status === 429) {
                console.log(`Лимит запросов превышен. Повторная попытка через 1 минуту.`);
                setTimeout(async () => {
                    await updateGoogleSheet(spreadsheetId, data, sheetTitle);
                }, 60000);
            }
        } else {
            console.error(`Неизвестная ошибка при выгрузке данных для таблицы ${spreadsheetId}:`, err);
        }
    }
}