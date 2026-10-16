import { User } from '../users/users.model';

/**
 * JWT отозван, если пользователя больше нет или токен выдан раньше последней смены пароля.
 * Модель вызывается статически, а не через DI: guard'ы инстанцируются в каждом модуле-потребителе,
 * и так не нужно прокидывать репозиторий User во все модули.
 */
export async function isJwtRevoked(payload: { id?: number; iat?: number }): Promise<boolean> {
    if (!payload?.id) {
        return true;
    }
    const user = await User.findByPk(payload.id, { attributes: ['id', 'passwordChangedAt'] });
    if (!user) {
        return true;
    }
    if (!user.passwordChangedAt || typeof payload.iat !== 'number') {
        return false;
    }
    // iat — в секундах; сравниваем с точностью до секунды, чтобы токен, выданный при входе
    // сразу после смены пароля (в ту же секунду), не считался отозванным
    return payload.iat < Math.floor(user.passwordChangedAt.getTime() / 1000);
}
