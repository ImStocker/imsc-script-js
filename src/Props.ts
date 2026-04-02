export enum AssetPropType {
  NULL = 'null',
  BOOLEAN = 'boolean',
  STRING = 'string',
  INTEGER = 'integer',
  FLOAT = 'float',
  ARRAY = 'array',
  TEXT = 'text',
  FILE = 'file',
  BLOB = 'blob',
  FORMULA = 'formula',
  ASSET = 'asset',
  ACCOUNT = 'account',
  SELECTION = 'selection',
  ENUM = 'enum',
  PROJECT = 'project',
  WORKSPACE = 'workspace',
  TIMESTAMP = 'timestamp',
  TYPE = 'type',
}

export type AssetPropValueTextOp = {
  insert?: any;
  attributes?: any;
};

export type AssetPropValueText = {
  Str: string;
  Ops: AssetPropValueTextOp[];
};

export type AssetPropValueFile = {
  FileId: string;
  Title: string;
  Size: number;
  Dir: string | null;
  Store: string;
};

export type AssetPropValueBlob = {
  Blob: string;
  Type: string;
  Key?: string;
};

export type AssetPropValueFormula = {
  F: any;
};

export type AssetPropValueAsset = {
  AssetId: string;
  Title: string;
  Name: string | null;
  Pid?: string;
  BlockId?: string | null;
  Anchor?: string | null;
};

export type AssetPropValueAccount = {
  AccountId: string;
  Name: string;
};

export type AssetPropValueEnum = {
  Enum: string;
  Name: string;
  Title: string;
};

export type AssetPropValueProject = {
  ProjectId: string;
  Title: string;
};

export type AssetPropValueTimestamp = {
  Str: string;
  Ts: number;
};

export type AssetPropValueWorkspace = {
  WorkspaceId: string;
  Title: string;
  Name: string | null;
  Pid?: string;
};

export type AssetPropValueSelection = {
  Select: any;
  Group: any;
  Str: string;
  Where: any;
  Order?: any[];
  Offset?: number;
  Count?: number;
};

export type AssetPropValueType = {
  Type: AssetPropType;
  Kind?: string;
  Of?: AssetPropValueType;
};

export type AssetPropValue =
  | null
  | string
  | number
  | boolean
  | number[]
  | AssetPropValueText
  | AssetPropValueFile
  | AssetPropValueBlob
  | AssetPropValueFormula
  | AssetPropValueAsset
  | AssetPropValueAccount
  | AssetPropValueSelection
  | AssetPropValueEnum
  | AssetPropValueProject
  | AssetPropValueTimestamp
  | AssetPropValueWorkspace
  | AssetPropValueType;

export type AssetPropValueNested =
  | AssetPropValue
  | { [prop: string]: AssetPropValueNested }
  | AssetPropValueNested[];

export type AssetProps = Record<string, AssetPropValue>;
export type AssetPropsNested = Record<string, AssetPropValueNested>;
export type AssetPropBlocks = Record<string, AssetProps>;

export function castDateToAssetPropValueTimestamp(
  date: Date,
): AssetPropValueTimestamp {
  return {
    Str: date.toISOString(),
    Ts: date.getTime() / 1000,
  };
}

export function castAssetPropValueToTimestamp(
  a: AssetPropValue,
): AssetPropValueTimestamp | null {
  if (a === null) return null;

  const a_type = getAssetPropType(a);
  if (a_type === AssetPropType.TIMESTAMP) {
    return a as AssetPropValueTimestamp;
  } else if (
    a_type === AssetPropType.INTEGER ||
    a_type === AssetPropType.FLOAT
  ) {
    const val_ms = (a as number) * 1000;
    const date = new Date(val_ms);
    return {
      Str: date.toISOString(),
      Ts: val_ms,
    };
  } else {
    const str = castAssetPropValueToString(a);
    const date = new Date(str);
    if (isNaN(date.getTime())) return null;
    return {
      Str: date.toISOString(),
      Ts: date.getTime() / 1000,
    };
  }
}

export function castAssetPropValueToDate(a: AssetPropValue): Date | null {
  const timestamp = castAssetPropValueToTimestamp(a);
  return timestamp ? new Date(timestamp.Ts * 1000) : null;
}


export function castAssetPropValueToEnum(
  a: AssetPropValue,
): AssetPropValueEnum | null {
  if (!a) return null;
  if (!(a as AssetPropValueEnum).Enum) return null;
  return a as AssetPropValueEnum;
}

export function castAssetPropValueToAccount(
  a: AssetPropValue,
): AssetPropValueAccount | null {
  if (!a) return null;
  if (!(a as AssetPropValueAccount).AccountId) return null;
  return a as AssetPropValueAccount;
}

export function castAssetPropValueToArray(a: AssetPropValue): number[] {
  return Array.isArray(a) ? (a as number[]) : [];
}

export function castAssetPropValueToString(a: AssetPropsPlainObjectValue): string {
  const a_type = getAssetPropType(a);
  switch (a_type) {
    case undefined:
    case AssetPropType.NULL:
      return '';
    case AssetPropType.TEXT:
      return (a as AssetPropValueText).Str;
    case AssetPropType.TIMESTAMP:
      return (a as AssetPropValueTimestamp).Str;
    case AssetPropType.INTEGER:
    case AssetPropType.FLOAT:
    case AssetPropType.STRING:
      return (a as any).toString();
    case AssetPropType.BOOLEAN:
      return a ? '1' : '0';
    case AssetPropType.BLOB:
      return `[](#blob:${(a as AssetPropValueBlob).Type}:${(a as AssetPropValueBlob).Blob
        })`;
    case AssetPropType.FILE:
      return `[${(a as AssetPropValueFile).Title ?? ''}](#file:${(a as AssetPropValueFile).FileId
        })`;
    case AssetPropType.ACCOUNT:
      return `[${(a as AssetPropValueAccount).Name ?? ''}](#account:${(a as AssetPropValueAccount).AccountId
        })`;
    case AssetPropType.ARRAY:
      // NOTE: При переводе в строку одиночных значений мы не можем получить значения массива, поэтому выводим только кол-во
      return `array[${(a as number[]).length}]`;
    case AssetPropType.ASSET:
      return `[${(a as AssetPropValueAsset).Title
        ? (a as AssetPropValueAsset).Title
        : ((a as AssetPropValueAsset).Name ?? '')
        }](#asset:${(a as AssetPropValueAsset).AssetId}${(a as AssetPropValueAsset).BlockId
          ? '#block:' +
          (a as AssetPropValueAsset).BlockId +
          ((a as AssetPropValueAsset).Anchor
            ? '~anchor:' + (a as AssetPropValueAsset).Anchor
            : '')
          : ''
        })`;
    case AssetPropType.WORKSPACE:
      return `[${(a as AssetPropValueWorkspace).Title
        ? (a as AssetPropValueWorkspace).Title
        : ((a as AssetPropValueWorkspace).Name ?? '')
        }](#workspace:${(a as AssetPropValueWorkspace).WorkspaceId})`;
    case AssetPropType.PROJECT:
      return `[${(a as AssetPropValueProject).Title
        ? (a as AssetPropValueProject).Title
        : ((a as AssetPropValueProject).ProjectId ?? '')
        }](#project:${(a as AssetPropValueProject).ProjectId})`;
    case AssetPropType.FORMULA:
    case AssetPropType.SELECTION:
      return JSON.stringify(a);
    case AssetPropType.ENUM:
      return (a as AssetPropValueEnum).Name;
    case AssetPropType.TYPE: {
      const ofval = (a as AssetPropValueType).Of;
      return (
        (a as AssetPropValueType).Type +
        ((a as AssetPropValueType).Kind
          ? `:${(a as AssetPropValueType).Kind}`
          : ``) +
        (ofval ? `[${castAssetPropValueToString(ofval)}]` : ``)
      );
    }
  }
}

export function castAssetPropPlainObjectValueToString(
  a: AssetPropsPlainObjectValue,
): string {
  if (Array.isArray(a)) {
    return a.map((b) => castAssetPropPlainObjectValueToString(b)).join(', ');
  } else {
    const a_type = getAssetPropType(a as AssetPropValue);
    if (a && a_type === undefined && typeof a === 'object') {
      return JSON.stringify(a);
    } else return castAssetPropValueToString(a as AssetPropValue);
  }
}

export function castAssetPropValueToBoolean(a: AssetPropsPlainObjectValue): boolean {
  return a !== undefined && a !== null && a !== 0 && a !== '' && a !== false;
}

export function castAssetPropValueToInt(a: AssetPropsPlainObjectValue): number | null {
  if (typeof a === 'number') {
    return Math.round(a);
  } else if (typeof a === 'boolean') {
    return a ? 1 : 0;
  }
  if (a && (a as AssetPropValueTimestamp).Ts) {
    return Math.round((a as AssetPropValueTimestamp).Ts);
  }
  const a_str = castAssetPropValueToString(a);
  const r = parseInt(a_str);
  return isNaN(r) ? null : r;
}

export function castAssetPropValueToFloat(a: AssetPropsPlainObjectValue): number | null {
  if (typeof a === 'number') {
    return a;
  }
  if (a && (a as AssetPropValueTimestamp).Ts) {
    return (a as AssetPropValueTimestamp).Ts;
  }
  const a_str = castAssetPropValueToString(a);
  const r = parseFloat(a_str);
  return isNaN(r) ? null : r;
}


export function castAssetPropValueToAsset(
  a: AssetPropsPlainObjectValue,
): AssetPropValueAsset | null {
  if (!a) return null;
  if ((a as AssetPropValueAsset).AssetId) {
    return a as AssetPropValueAsset;
  }
  let val = a;
  if ((a as AssetPropValueText).Ops) {
    val = convertAssetPropValueTextOpsToStr((a as AssetPropValueText).Ops).str;
  }

  val = castAssetPropValueToString(val).trim();
  if (!val) return null;
  const val_text_match = val.match(
    /^\[(.*?)\]\(#asset:(.*?)(?:#block:([^#~)]*)(?:~anchor:([^)]*))?)?\)$/,
  );

  if (val_text_match) {
    const [_, title, asset_id, block_id, anchor_id] = val_text_match;
    return {
      Title: title,
      AssetId: asset_id,
      Name: null,
      BlockId: block_id,
      Anchor: anchor_id,
    };
  }

  return null;
}

export function* walkAssetPropValueTextOps(
  ops: AssetPropValueTextOp[],
): Generator<{
  op: AssetPropValueTextOp;
  insertProp?: { value: AssetPropValue };
  insertTask?: { value: AssetPropValueAsset };
  insertFile?: { value: AssetPropValueFile };
  attributeAsset?: { value: AssetPropValueAsset };
}> {
  if (!(ops as unknown)) return;
  for (const op of ops) {
    yield {
      op,
      insertProp:
        op.insert && op.insert.prop && op.insert.prop.value !== undefined
          ? op.insert.prop
          : undefined,
      insertTask:
        op.insert &&
          op.insert.task &&
          op.insert.task.value !== undefined &&
          (op.insert.task.value as AssetPropValueAsset).AssetId
          ? op.insert.task
          : undefined,
      insertFile:
        op.insert &&
          op.insert.file &&
          op.insert.file.value !== undefined &&
          (op.insert.file.value as AssetPropValueFile).FileId
          ? op.insert.file
          : undefined,
      attributeAsset:
        op.attributes &&
          op.attributes.asset &&
          op.attributes.asset.value !== undefined &&
          (op.attributes.asset.value as AssetPropValueAsset).AssetId
          ? op.attributes.asset
          : undefined,
    };
  }
}


export function convertAssetPropValueTextOpsToStr(
  ops: AssetPropValueTextOp[],
): { str: string; plain: boolean } {
  const str: string[] = [];
  let plain = true;
  for (const op_struct of walkAssetPropValueTextOps(ops)) {
    if (typeof op_struct.op.insert !== 'string') {
      plain = false;
      if (op_struct.op.insert) {
        if ((op_struct.op.insert as any).file) {
          str.push(
            ((op_struct.op.insert as any).file.inline ? '!' : '') +
            castAssetPropValueToString(
              (op_struct.op.insert as any).file.value,
            ),
          );
        } else if ((op_struct.op.insert as any).task) {
          str.push(
            castAssetPropValueToString((op_struct.op.insert as any).task.value),
          );
        }
      }
      continue;
    }
    if (op_struct.op.attributes) {
      plain = false;
    }
    if (op_struct.attributeAsset) {
      str.push(
        `[${op_struct.op.insert.replace(/[[\]]/g, (x) => '\\' + x)}](#asset:${op_struct.attributeAsset.value.AssetId
        }${op_struct.attributeAsset.value.BlockId
          ? '#block:' +
          op_struct.attributeAsset.value.BlockId +
          (op_struct.attributeAsset.value.Anchor
            ? '~anchor:' + op_struct.attributeAsset.value.Anchor
            : '')
          : ''
        })`,
      );
    } else {
      str.push(op_struct.op.insert);
    }
  }

  return {
    str: str.join(''),
    plain,
  };
}

export function getAssetPropType(v: AssetPropsPlainObjectValue): AssetPropType | undefined {
  if (v === undefined || v === null) return AssetPropType.NULL;
  else if (typeof v === 'string') return AssetPropType.STRING;
  else if (typeof v === 'boolean') return AssetPropType.BOOLEAN;
  else if (typeof v === 'number') {
    return Number.isInteger(v) ? AssetPropType.INTEGER : AssetPropType.FLOAT;
  } else if (Array.isArray(v)) return AssetPropType.ARRAY;
  else if (typeof v === 'object') {
    if (
      Array.isArray((v as AssetPropValueText).Ops) &&
      typeof (v as AssetPropValueText).Str === 'string'
    ) {
      return AssetPropType.TEXT;
    } else if (
      typeof (v as AssetPropValueFile).FileId === 'string' &&
      typeof (v as AssetPropValueFile).Title === 'string' &&
      typeof (v as AssetPropValueFile).Size === 'number'
    ) {
      return AssetPropType.FILE;
    } else if (
      typeof (v as AssetPropValueTimestamp).Ts === 'number' &&
      typeof (v as AssetPropValueTimestamp).Str === 'string'
    ) {
      return AssetPropType.TIMESTAMP;
    } else if (
      typeof (v as AssetPropValueBlob).Blob === 'string' &&
      typeof (v as AssetPropValueBlob).Type === 'string'
    ) {
      return AssetPropType.BLOB;
    } else if (
      typeof (v as AssetPropValueEnum).Enum === 'string' &&
      typeof (v as AssetPropValueEnum).Name === 'string'
    ) {
      return AssetPropType.ENUM;
    } else if (typeof (v as AssetPropValueFormula).F === 'object') {
      return AssetPropType.FORMULA;
    } else if (typeof (v as AssetPropValueAsset).AssetId === 'string') {
      return AssetPropType.ASSET;
    } else if (typeof (v as AssetPropValueWorkspace).WorkspaceId === 'string') {
      return AssetPropType.WORKSPACE;
    } else if (typeof (v as AssetPropValueProject).ProjectId === 'string') {
      return AssetPropType.PROJECT;
    } else if (typeof (v as AssetPropValueAccount).AccountId === 'string') {
      return AssetPropType.ACCOUNT;
    } else if (typeof (v as AssetPropValueType).Type === 'string') {
      return AssetPropType.TYPE;
    } else if (Array.isArray((v as AssetPropValueSelection).Where)) {
      return AssetPropType.SELECTION;
    }
  }
  return undefined;
}

export type AssetPropsPlainObjectValue =
  | AssetPropValue
  | AssetPropValue[]
  | AssetPropsPlainObject
  | AssetPropsPlainObject[];

export type AssetPropsPlainObject = {
  [key: string]: AssetPropsPlainObjectValue;
};


function _jsonCompare(obj1: any, obj2: any) {
  if (obj1 === undefined && obj2 !== undefined) {
    return -1;
  } else if (obj1 !== undefined && obj2 === undefined) {
    return 1;
  } else {
    function jsonSorter(key: string, value: any) {
      if (value === null) {
        return null;
      }
      if (Array.isArray(value)) {
        return value;
      }
      if (typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).sort());
      }
      return value;
    }
    const json1 = JSON.stringify(obj1, jsonSorter);
    const json2 = JSON.stringify(obj2, jsonSorter);
    return json1.localeCompare(json2);
  }
}

function _compareAssetPropValuesTexts(
  ac: AssetPropValueText,
  bc: AssetPropValueText,
) {
  const str_compare = ac.Str.localeCompare(bc.Str);
  if (str_compare !== 0) {
    return str_compare;
  }
  if (ac.Ops.length !== bc.Ops.length) {
    return ac.Ops.length < bc.Ops.length ? -1 : 1;
  }
  for (let i = 0; i < ac.Ops.length; i++) {
    const aop = ac.Ops[i];
    const bop = bc.Ops[i];
    if (aop.insert === undefined && bop.insert !== undefined) {
      return -1;
    }
    if (aop.insert !== undefined && bop.insert === undefined) {
      return 1;
    } else if (aop.insert !== undefined && bop.insert !== undefined) {
      if (typeof aop.insert === 'string' && typeof bop.insert === 'string') {
        const ins_comp = aop.insert.localeCompare(bop.insert);
        if (ins_comp !== 0) return ins_comp;
      } else {
        const json_compare = _jsonCompare(aop.insert, bop.insert);
        if (json_compare !== 0) return json_compare;
      }
    }
    if (aop.attributes === undefined && bop.attributes !== undefined) {
      return -1;
    }
    if (aop.attributes !== undefined && bop.attributes === undefined) {
      return 1;
    } else if (aop.attributes !== undefined && bop.attributes !== undefined) {
      const json_compare = _jsonCompare(aop.attributes, bop.attributes);
      if (json_compare !== 0) return json_compare;
    }
  }
  return 0;
}

export function compareAssetPropValues(
  a: AssetPropsPlainObjectValue | undefined,
  b: AssetPropsPlainObjectValue | undefined,
  exact = true,
): number {
  const an = a ?? null;
  const bn = b ?? null;
  if (an === null && bn === null) return 0;
  if (an === bn) return 0;
  if (an === null) return -1;
  if (bn === null) return 1;
  const a_type = getAssetPropType(an);
  const b_type = getAssetPropType(an);
  if (a_type === b_type) {
    switch (a_type) {
      case undefined:
        return -1;
      case AssetPropType.NULL:
      case AssetPropType.INTEGER:
      case AssetPropType.FLOAT:
      case AssetPropType.BOOLEAN:
        return an === bn ? 0 : an < bn ? -1 : 1;
      case AssetPropType.STRING:
        return (an as string).localeCompare(bn as string);
      case AssetPropType.TIMESTAMP:
        return (an as AssetPropValueTimestamp).Str.localeCompare(
          (bn as AssetPropValueTimestamp).Str,
        );
      case AssetPropType.TEXT: {
        return _compareAssetPropValuesTexts(
          a as AssetPropValueText,
          b as AssetPropValueText,
        );
      }
      case AssetPropType.BLOB: {
        const ac = a as AssetPropValueBlob;
        const bc = b as AssetPropValueBlob;
        if (ac.Type === bc.Type) {
          return ac.Blob.localeCompare(bc.Blob);
        } else return ac.Type.localeCompare(bc.Type);
      }
      case AssetPropType.FILE: {
        const ac = a as AssetPropValueFile;
        const bc = b as AssetPropValueFile;
        const mcomp = ac.FileId.localeCompare(bc.FileId);
        if (mcomp === 0) {
          return 0;
        } else {
          const scomp = ac.Title.localeCompare(bc.Title);
          if (scomp === 0) return mcomp;
          return scomp;
        }
      }
      case AssetPropType.ACCOUNT: {
        const ac = a as AssetPropValueAccount;
        const bc = b as AssetPropValueAccount;
        const mcomp = ac.AccountId.localeCompare(bc.AccountId);
        if (mcomp === 0) {
          return 0;
        } else {
          const scomp = ac.Name.localeCompare(bc.Name);
          if (scomp === 0) return mcomp;
          return scomp;
        }
      }
      case AssetPropType.ARRAY: {
        const ac = a as number[];
        const bc = b as number[];
        if (ac.length === bc.length) {
          // NOTE: При сравнении одиночных значений мы не можем проверить равенство массивов -> проверяются только индексы
          for (let i = 0; i < ac.length; i++) {
            if (ac[i] !== bc[i]) {
              return ac[i] - bc[i];
            }
          }
          return 0;
        } else {
          return ac.length - bc.length;
        }
      }
      case AssetPropType.ASSET: {
        const ac = a as AssetPropValueAsset;
        const bc = b as AssetPropValueAsset;
        const mcomp = ac.AssetId.localeCompare(bc.AssetId);
        if (mcomp === 0) {
          return 0;
        } else {
          let scomp = ac.Title.localeCompare(bc.Title);
          if (scomp === 0) {
            scomp = (ac.Name ?? '').localeCompare(bc.Name ?? '');
            if (scomp === 0) return mcomp;
          }
          return scomp;
        }
      }
      case AssetPropType.WORKSPACE: {
        const ac = a as AssetPropValueWorkspace;
        const bc = b as AssetPropValueWorkspace;
        const mcomp = ac.WorkspaceId.localeCompare(bc.WorkspaceId);
        if (mcomp === 0) {
          return 0;
        } else {
          let scomp = ac.Title.localeCompare(bc.Title);
          if (scomp === 0) {
            scomp = (ac.Name ?? '').localeCompare(bc.Name ?? '');
            if (scomp === 0) return mcomp;
          }
          return scomp;
        }
      }
      case AssetPropType.PROJECT: {
        const ac = a as AssetPropValueProject;
        const bc = b as AssetPropValueProject;
        const mcomp = ac.ProjectId.localeCompare(bc.ProjectId);
        if (mcomp === 0) {
          return 0;
        } else {
          const scomp = ac.Title.localeCompare(bc.Title);
          if (scomp === 0) return mcomp;
          return scomp;
        }
      }
      case AssetPropType.FORMULA:
      case AssetPropType.SELECTION: {
        return _jsonCompare(a, b);
      }
      case AssetPropType.ENUM: {
        const ac = a as AssetPropValueEnum;
        const bc = b as AssetPropValueEnum;
        const mcomp = ac.Enum.localeCompare(bc.Enum);
        if (mcomp === 0) {
          return ac.Name.localeCompare(bc.Name);
        } else return mcomp;
      }
      case AssetPropType.TYPE: {
        const ac = a as AssetPropValueType;
        const bc = b as AssetPropValueType;
        const mcomp = ac.Type.localeCompare(bc.Type);
        if (mcomp === 0) {
          const akind = ac.Kind ?? '';
          const bkind = bc.Kind ?? '';
          const kindcomp = akind.localeCompare(bkind);
          if (kindcomp === 0) {
            const aof = ac.Of ?? null;
            const bof = bc.Of ?? null;
            return compareAssetPropValues(aof, bof);
          } else return kindcomp;
        } else return mcomp;
      }
    }
  } else {
    const a_str = castAssetPropValueToString(an);
    const b_str = castAssetPropValueToString(an);
    const comp = a_str.localeCompare(b_str);
    if (comp === 0 && exact) {
      return -1;
    }
    return comp;
  }
}