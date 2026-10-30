export type AssetPropWhereString = string;
export type AssetPropWhereNumber = number;
export type AssetPropWhereBool = boolean;
export type AssetPropWhereNull = null;

export type AssetPropWhereFile = {
  FileId: string;
};

export type AssetPropWhereAccount = {
  AccountId: string;
};

export type AssetPropWhereTask = {
  TaskNum: number;
};

export type AssetPropWhereAsset = {
  AssetId: string;
};

export type AssetPropWhereEnum = {
  Enum: string;
  Name: string;
};

export type AssetPropWhereProject = {
  ProjectId: string;
};

export type AssetPropWhereProp = {
  prop: string;
};

export type AssetPropWhereTimestamp = {
  Ts: number;
};

export type AssetPropWhereType = {
  Type: string;
  Kind?: string;
  Of?: AssetPropWhereType;
};

export type AssetPropWhereValue =
  | AssetPropWhereString
  | AssetPropWhereNumber
  | AssetPropWhereBool
  | AssetPropWhereNull
  | AssetPropWhereFile
  | AssetPropWhereAccount
  | AssetPropWhereTask
  | AssetPropWhereAsset
  | AssetPropWhereEnum
  | AssetPropWhereProject
  | AssetPropWhereTimestamp
  | AssetPropWhereType;

export enum AssetPropWhereOpKind {
  // Равенство / не равенство
  // - допускаются любые значения и свойства
  EQUAL = '=',
  EQUAL_NOT = '!=',
  // Любой из
  // - допускаются массив любых значений
  ANY = 'any',
  ANY_NOT = 'any!=',
  // Больше / меньше:
  // - допускается либо строка, либо число, либо свойство
  LESS = '<',
  LESS_EQUAL = '<=',
  MORE = '>',
  MORE_EQUAL = '>=',
  // Содержит подстроку
  // - допускается только строка
  LIKE = 'like',
  LIKE_NOT = 'like!=',
  // Объединение условий через ИЛИ/И
  // - допускается массив подусловий
  OR = 'or',
  AND = 'and',
  // Проверка длины массива или строки
  // - допускается только число
  LEN_EQUAL = 'len=',
  LEN_LESS = 'len<',
  LEN_LESS_EQUAL = 'len<=',
  LEN_EQUAL_NOT = 'len!=',
  LEN_MORE = 'len>',
  LEN_MORE_EQUAL = 'len>=',
  // Проверка на пустоту
  // - допускается только лог. тип
  EMPTY = 'empty',
  CHECKED = 'checked',
  // Проверка по регулярному выражению
  // - допускается только строка
  MATCH = 'match',
}

export type AssetPropWhereOpEq = {
  op: AssetPropWhereOpKind.EQUAL | AssetPropWhereOpKind.EQUAL_NOT;
  v: AssetPropWhereValue | AssetPropWhereProp;
};

export type AssetPropWhereOpAny = {
  op: AssetPropWhereOpKind.ANY | AssetPropWhereOpKind.ANY_NOT;
  v: AssetPropWhereValue[];
};

export type AssetPropWhereOpLessMore = {
  op:
    | AssetPropWhereOpKind.LESS
    | AssetPropWhereOpKind.LESS_EQUAL
    | AssetPropWhereOpKind.MORE
    | AssetPropWhereOpKind.MORE_EQUAL;
  v:
    | AssetPropWhereNumber
    | AssetPropWhereString
    | AssetPropWhereProp
    | AssetPropWhereTimestamp;
};

export type AssetPropWhereOpLike = {
  op: AssetPropWhereOpKind.LIKE | AssetPropWhereOpKind.LIKE_NOT;
  v: AssetPropWhereString;
};

export type AssetPropWhereOpOr = {
  op: AssetPropWhereOpKind.OR;
  v: AssetPropWhere[];
};

export type AssetPropWhereOpAnd = {
  op: AssetPropWhereOpKind.AND;
  v: AssetPropWhere[];
};

export type AssetPropWhereOpLen = {
  op:
    | AssetPropWhereOpKind.LEN_EQUAL
    | AssetPropWhereOpKind.LEN_LESS
    | AssetPropWhereOpKind.LEN_LESS_EQUAL
    | AssetPropWhereOpKind.LEN_MORE
    | AssetPropWhereOpKind.LEN_MORE_EQUAL
    | AssetPropWhereOpKind.LEN_EQUAL_NOT;
  v: AssetPropWhereNumber;
};

export type AssetPropWhereOpEmpty = {
  op: AssetPropWhereOpKind.EMPTY;
  v: AssetPropWhereBool;
};

export type AssetPropWhereOpChecked = {
  op: AssetPropWhereOpKind.CHECKED;
  v: AssetPropWhereBool;
};

export type AssetPropWhereOpMatch = {
  op: AssetPropWhereOpKind.MATCH;
  v: AssetPropWhereString;
};

export type AssetPropWhereOp =
  | AssetPropWhereOpAny
  | AssetPropWhereOpEq
  | AssetPropWhereOpLen
  | AssetPropWhereOpLessMore
  | AssetPropWhereOpLike
  | AssetPropWhereOpOr
  | AssetPropWhereOpAnd
  | AssetPropWhereOpEmpty
  | AssetPropWhereOpChecked
  | AssetPropWhereOpMatch;

export type AssetPropWhereCondition =
  | AssetPropWhereEnum
  | AssetPropWhereOp
  | AssetPropWhereValue
  | AssetPropWhereProp
  | AssetPropWhereValue[];

export type AssetPropWhere = {
  [field: string]: AssetPropWhereCondition | undefined;
};

export function getAssetPropWhereProp(
  cond: AssetPropWhereCondition,
): string | null {
  if (cond && (cond as AssetPropWhereProp).prop) {
    return (cond as AssetPropWhereProp).prop;
  } else {
    return null;
  }
}

export function convertAssetPropWhereConditionToOp(
  condition: AssetPropWhereCondition,
): AssetPropWhereOp {
  if (condition === null || condition === undefined) {
    return {
      op: AssetPropWhereOpKind.EQUAL,
      v: null,
    };
  } else if (Array.isArray(condition)) {
    return {
      op: AssetPropWhereOpKind.ANY,
      v: condition,
    };
  } else if (
    typeof condition === 'object' &&
    typeof (condition as AssetPropWhereOp).op === 'string'
  ) {
    return condition as AssetPropWhereOp;
  } else {
    return {
      op: AssetPropWhereOpKind.EQUAL,
      v: condition as AssetPropWhereValue,
    };
  }
}
