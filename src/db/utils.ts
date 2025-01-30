export const parseDate = (date: string | Date) => new Date(date);

export const toBoolean = (value: number | boolean) => Boolean(value);

export const buildWhereClause = (
  table: string,
  where?: Record<string, any>
): { clause: string; params: any[] } => {
  const params: any[] = [];
  if (!where || Object.keys(where).length === 0) {
    return { clause: '', params };
  }

  const conditions = Object.entries(where).map(([key, value]) => {
    params.push(value);
    return `${table}.${key} = ?`;
  });

  return {
    clause: ` WHERE ${conditions.join(' AND ')}`,
    params
  };
};

export const buildOrderByClause = (
  table: string,
  orderBy?: Record<string, 'asc' | 'desc'>
): string => {
  if (!orderBy || Object.keys(orderBy).length === 0) {
    return '';
  }

  const orderClauses = Object.entries(orderBy)
    .map(([key, dir]) => `${table}.${key} ${dir}`);

  return ` ORDER BY ${orderClauses.join(', ')}`;
};