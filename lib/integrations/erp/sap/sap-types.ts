// SAP-specific types and interfaces

export interface SAPMaterial {
  MATERIAL: string
  MAKTX: string // Material description
  MAKTX_LONG?: string // Long description
  MTART: string // Material type
  MEINS: string // Base unit of measure
  MATKL: string // Material group
  LVORM: string // Deletion flag
  BRGEW: number // Gross weight
  NTGEW: number // Net weight
  GEWEI: string // Weight unit
  VOLUM: number // Volume
  VOLEH: string // Volume unit
}

export interface SAPInventory {
  MATERIAL: string
  PLANT: string
  STORAGE_LOC: string
  BATCH?: string
  STOCK_TYPE: string
  QUANTITY: number
  UNIT: string
  RESTRICTED_STOCK?: number
  BLOCKED_STOCK?: number
  LAST_CHANGE: string // YYYYMMDD
}

export interface SAPOrder {
  VBELN: string // Sales order number
  POSNR: string // Item number
  AUART: string // Order type
  KUNNR: string // Customer number
  BSTNK?: string // Customer PO number
  ERDAT: string // Creation date YYYYMMDD
  ERZET: string // Creation time HHMMSS
  NETWR: number // Net value
  WAERK: string // Currency
  VKORG: string // Sales organization
  VTWEG: string // Distribution channel
  SPART: string // Division
  ITEMS: SAPOrderItem[]
}

export interface SAPOrderItem {
  POSNR: string // Item number
  MATNR: string // Material number
  ARKTX: string // Item description
  KWMENG: number // Order quantity
  VRKME: string // Sales unit
  NETPR: number // Net price
  NETWR: number // Net value
  WAERK: string // Currency
  WERKS: string // Plant
  LGORT: string // Storage location
}

export interface SAPCustomer {
  KUNNR: string // Customer number
  NAME1: string // Name 1
  NAME2?: string // Name 2
  NAME3?: string // Name 3
  NAME4?: string // Name 4
  STRAS: string // Street
  ORT01: string // City
  PSTLZ: string // Postal code
  LAND1: string // Country
  REGIO: string // Region/State
  TELF1?: string // Telephone 1
  TELFX?: string // Fax
  STCEG?: string // Tax number
  KTOKD: string // Account group
}

export interface SAPRFC {
  host: string
  sysnr: string
  client: string
  user: string
  passwd: string
  lang?: string
}

export interface SAPODataConfig {
  baseUrl: string
  username: string
  password: string
}

// BAPI Response structures
export interface BAPIReturn {
  TYPE: string // S=Success, E=Error, W=Warning, I=Info
  ID: string
  NUMBER: string
  MESSAGE: string
  LOG_NO?: string
  LOG_MSG_NO?: string
  MESSAGE_V1?: string
  MESSAGE_V2?: string
  MESSAGE_V3?: string
  MESSAGE_V4?: string
}

export interface BAPIMaterialGetListResponse {
  MATNRLIST: SAPMaterial[]
  RETURN: BAPIReturn[]
}

export interface BAPIOrderCreateResponse {
  SALESDOCUMENT: string
  RETURN: BAPIReturn[]
}

// Mapping helpers
export const SAPMaterialTypes: Record<string, string> = {
  'FERT': 'Finished Product',
  'HALB': 'Semi-Finished Product',
  'ROH': 'Raw Material',
  'HIBE': 'Operating Supplies',
  'VERP': 'Packaging Material',
  'HAWA': 'Trading Goods',
  'DIEN': 'Services',
}

export const SAPOrderTypes: Record<string, string> = {
  'TA': 'Standard Order',
  'ZOR': 'Custom Order',
  'RE': 'Returns',
  'FD': 'Free Delivery',
  'CS': 'Cash Sale',
}

export const SAPStockTypes: Record<string, string> = {
  '': 'Unrestricted Use',
  'S': 'Blocked Stock',
  'Q': 'Quality Inspection',
  'R': 'Returns',
  'T': 'In Transit',
}

// SAP Function Module names
export const SAPFunctionModules = {
  // Material Management
  MATERIAL_GET_LIST: 'BAPI_MATERIAL_GETLIST',
  MATERIAL_GET_DETAIL: 'BAPI_MATERIAL_GET_DETAIL',
  MATERIAL_CREATE: 'BAPI_MATERIAL_SAVEDATA',
  MATERIAL_CHANGE: 'BAPI_MATERIAL_SAVEDATA',
  
  // Inventory
  STOCK_GET: 'BAPI_MATERIAL_STOCK_REQ_LIST',
  GOODS_MOVEMENT: 'BAPI_GOODSMVT_CREATE',
  
  // Sales & Distribution
  ORDER_CREATE: 'BAPI_SALESORDER_CREATEFROMDAT2',
  ORDER_CHANGE: 'BAPI_SALESORDER_CHANGE',
  ORDER_GET_LIST: 'BAPI_SALESORDER_GETLIST',
  ORDER_GET_DETAIL: 'BAPI_SALESORDER_GETSTATUS',
  
  // Customer Master
  CUSTOMER_GET_LIST: 'BAPI_CUSTOMER_GETLIST',
  CUSTOMER_GET_DETAIL: 'BAPI_CUSTOMER_GETDETAIL2',
  CUSTOMER_CREATE: 'BAPI_CUSTOMER_CREATEFROMDATA1',
  CUSTOMER_CHANGE: 'BAPI_CUSTOMER_CHANGEFROMDATA1',
  
  // Utility
  COMMIT: 'BAPI_TRANSACTION_COMMIT',
  ROLLBACK: 'BAPI_TRANSACTION_ROLLBACK',
}