import type { AssetPropWhere } from './PropsWhere';

export type AssetPropsSelectionFieldObj = {
  func?: string;
  prop: string;
  as?: string;
};

export type AssetPropsSelectionField = string | AssetPropsSelectionFieldObj;

export type AssetPropsSelectionOrder =
  | string
  | (AssetPropsSelectionFieldObj & {
      desc?: boolean;
    });

export type AssetPropsSelectionBase = {
  where?: AssetPropWhere;
  group?: AssetPropsSelectionField[];
  order?: AssetPropsSelectionOrder[];
  offset?: number;
  count?: number;
};

export type AssetPropsSelection = AssetPropsSelectionBase & {
  select: AssetPropsSelectionField[];
};
