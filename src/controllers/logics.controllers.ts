import cron from 'node-cron';
import { fetchDataAndSave, exportToGoogle } from '../services/logics.services';

export default function cronFunction(): void {
    cron.schedule('0 * * * *', async () => {
        console.log('Запрос по эндпоинту и сохранение данных в бд...');
        try {
            fetchDataAndSave();
        } catch (error) {
            console.error(error);
        }
    });

    cron.schedule('10 0 * * *', async () => {
        console.log('Экспорт данных в google таблицы...');
        try {
            await exportToGoogle();
        } catch (error) {
            console.error(error);
        }
    });
}