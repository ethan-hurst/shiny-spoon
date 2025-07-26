// PRP-013: NetSuite SuiteQL Queries
export class NetSuiteQueries {
  /**
   * Sanitize SQL values to prevent SQL injection
   * - Escapes single quotes
   * - Removes dangerous characters and SQL comment tokens
   * - Validates against common SQL injection patterns
   */
  private sanitizeSqlValue(value: string): string {
    if (!value) {
      return ''
    }
    
    // First, escape single quotes by doubling them (standard SQL escaping)
    let sanitized = value.replace(/'/g, "''")
    
    // Remove SQL comment tokens
    sanitized = sanitized.replace(/--/g, '')
    sanitized = sanitized.replace(/\/\*/g, '')
    sanitized = sanitized.replace(/\*\//g, '')
    
    // Remove or escape other dangerous characters
    sanitized = sanitized.replace(/;/g, '') // Remove semicolons
    sanitized = sanitized.replace(/\\/g, '') // Remove backslashes
    
    // Remove common SQL injection patterns
    sanitized = sanitized.replace(/\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b/gi, '')
    
    // Remove null bytes
    sanitized = sanitized.replace(/\x00/g, '')
    
    return sanitized
  }
  
  /**
   * Safely format date for NetSuite SuiteQL
   */
  private formatDate(date: Date | null | undefined): string {
    // Validate date parameter
    if (!date) {
      throw new Error('Invalid date: date parameter is null or undefined')
    }
    
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new Error('Invalid date: parameter must be a valid Date object')
    }
    
    // Format date as YYYY-MM-DD HH:MM:SS
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    const hours = String(date.getUTCHours()).padStart(2, '0')
    const minutes = String(date.getUTCMinutes()).padStart(2, '0')
    const seconds = String(date.getUTCSeconds()).padStart(2, '0')
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }
  /**
   * Get products query with pagination and filtering
   */
  getProductsQuery(options: {
    modifiedAfter?: Date
    limit: number
    offset: number
  }): string {
    const dateFilter = options.modifiedAfter
      ? `AND i.lastmodifieddate > TO_DATE('${this.formatDate(options.modifiedAfter)}', 'YYYY-MM-DD HH24:MI:SS')`
      : ''

    return `
      SELECT 
        i.id,
        i.itemid as sku,
        i.displayname as name,
        i.salesdescription as description,
        i.baseprice,
        i.weight,
        i.weightunit,
        i.custitem_dimensions as dimensions,
        CASE WHEN i.isinactive = 'F' THEN 'T' ELSE 'F' END as isactive,
        i.lastmodifieddate,
        i.itemtype,
        c.name as category
      FROM item i
      LEFT JOIN itemcategory c ON i.category = c.id
      WHERE i.itemtype IN ('inventoryitem', 'noninventoryitem', 'kititem', 'assemblyitem')
        ${dateFilter}
      ORDER BY i.lastmodifieddate DESC
      LIMIT ${options.limit}
      OFFSET ${options.offset}
    `
  }

  /**
   * Get inventory query for a specific location
   */
  getInventoryQuery(options: {
    locationId: string
    modifiedAfter?: Date
  }): string {
    const dateFilter = options.modifiedAfter
      ? `AND ib.lastmodifieddate > TO_DATE('${this.formatDate(options.modifiedAfter)}', 'YYYY-MM-DD HH24:MI:SS')`
      : ''

    return `
      SELECT
        i.id as itemid,
        i.itemid as sku,
        i.displayname as itemname,
        l.id as locationid,
        l.name as locationname,
        ib.quantityavailable,
        ib.quantityonhand,
        ib.quantityintransit,
        ib.quantityonorder,
        ib.reorderpoint,
        ib.preferredstocklevel,
        ib.lastmodifieddate
      FROM inventorybalance ib
      JOIN item i ON ib.item = i.id
      JOIN location l ON ib.location = l.id
      WHERE ib.location = '${this.sanitizeSqlValue(options.locationId)}'
        AND i.itemtype IN ('inventoryitem', 'assemblyitem', 'kititem')
        ${dateFilter}
      ORDER BY ib.lastmodifieddate DESC
    `
  }

  /**
   * Get pricing query with price levels
   */
  getPricingQuery(options: {
    modifiedAfter?: Date
  }): string {
    const dateFilter = options.modifiedAfter
      ? `WHERE ip.lastmodifieddate > TO_DATE('${this.formatDate(options.modifiedAfter)}', 'YYYY-MM-DD HH24:MI:SS')`
      : ''

    return `
      SELECT
        i.id as itemid,
        i.itemid as sku,
        i.displayname as itemname,
        pl.id as pricelevelid,
        pl.name as pricelevelname,
        ip.unitprice,
        c.symbol as currency,
        ip.lastmodifieddate
      FROM itemprice ip
      JOIN item i ON ip.item = i.id
      JOIN pricelevel pl ON ip.pricelevel = pl.id
      JOIN currency c ON ip.currency = c.id
      ${dateFilter}
      ORDER BY i.itemid, pl.name
    `
  }

  /**
   * Get all active locations
   */
  getLocationsQuery(): string {
    return `
      SELECT 
        id,
        name,
        isinactive,
        makeinventoryavailable,
        address1,
        address2,
        city,
        state,
        zip,
        country
      FROM location
      WHERE isinactive = 'F'
      ORDER BY name
    `
  }

  /**
   * Get price levels
   */
  getPriceLevelsQuery(): string {
    return `
      SELECT
        id,
        name,
        isinactive,
        isqtydiscountsupported
      FROM pricelevel
      WHERE isinactive = 'F'
      ORDER BY name
    `
  }

  /**
   * Get customer information
   */
  getCustomersQuery(options: {
    modifiedAfter?: Date
    limit: number
    offset: number
  }): string {
    const dateFilter = options.modifiedAfter
      ? `AND c.lastmodifieddate > TO_DATE('${this.formatDate(options.modifiedAfter)}', 'YYYY-MM-DD HH24:MI:SS')`
      : ''

    return `
      SELECT
        c.id,
        c.entityid as customercode,
        c.companyname,
        c.email,
        c.phone,
        c.isinactive,
        c.lastmodifieddate,
        c.creditlimit,
        c.balance,
        c.daysoverdue,
        ct.name as category,
        pl.name as pricelevel
      FROM customer c
      LEFT JOIN customercategory ct ON c.category = ct.id
      LEFT JOIN pricelevel pl ON c.pricelevel = pl.id
      WHERE c.isinactive = 'F'
        ${dateFilter}
      ORDER BY c.lastmodifieddate DESC
      LIMIT ${options.limit}
      OFFSET ${options.offset}
    `
  }

  /**
   * Get sales orders
   */
  getSalesOrdersQuery(options: {
    modifiedAfter?: Date
    status?: string[]
    limit: number
    offset: number
  }): string {
    const dateFilter = options.modifiedAfter
      ? `AND so.lastmodifieddate > TO_DATE('${this.formatDate(options.modifiedAfter)}', 'YYYY-MM-DD HH24:MI:SS')`
      : ''
    
    const statusFilter = options.status?.length
      ? `AND so.orderstatus IN (${options.status.map(s => `'${s}'`).join(', ')})`
      : ''

    return `
      SELECT
        so.id,
        so.tranid as ordernumber,
        so.trandate,
        so.duedate,
        so.orderstatus,
        so.total,
        so.subtotal,
        so.taxtotal,
        so.shippingcost,
        so.lastmodifieddate,
        c.entityid as customercode,
        c.companyname as customername
      FROM salesorder so
      JOIN customer c ON so.entity = c.id
      WHERE 1=1
        ${dateFilter}
        ${statusFilter}
      ORDER BY so.lastmodifieddate DESC
      LIMIT ${options.limit}
      OFFSET ${options.offset}
    `
  }

  /**
   * Get sales order lines
   */
  getSalesOrderLinesQuery(orderId: string): string {
    return `
      SELECT
        sol.id,
        sol.line as linenumber,
        i.itemid as sku,
        i.displayname as itemname,
        sol.quantity,
        sol.rate as unitprice,
        sol.amount,
        sol.quantityshipped,
        sol.quantitybackordered,
        l.name as locationname
      FROM salesorderline sol
      JOIN item i ON sol.item = i.id
      LEFT JOIN location l ON sol.location = l.id
      WHERE sol.salesorder = '${this.sanitizeSqlValue(orderId)}'
      ORDER BY sol.line
    `
  }

  /**
   * Get item by SKU
   */
  getItemBySKUQuery(sku: string): string {
    return `
      SELECT
        i.id,
        i.itemid as sku,
        i.displayname as name,
        i.salesdescription as description,
        i.baseprice,
        i.weight,
        i.weightunit,
        i.custitem_dimensions as dimensions,
        CASE WHEN i.isinactive = 'F' THEN 'T' ELSE 'F' END as isactive,
        i.itemtype,
        c.name as category
      FROM item i
      LEFT JOIN itemcategory c ON i.category = c.id
      WHERE i.itemid = '${this.sanitizeSqlValue(sku)}'
    `
  }

  /**
   * Get inventory by SKU across all locations
   */
  getInventoryBySKUQuery(sku: string): string {
    return `
      SELECT
        i.itemid as sku,
        l.id as locationid,
        l.name as locationname,
        ib.quantityavailable,
        ib.quantityonhand,
        ib.quantityintransit,
        ib.quantityonorder,
        ib.reorderpoint,
        ib.preferredstocklevel
      FROM inventorybalance ib
      JOIN item i ON ib.item = i.id
      JOIN location l ON ib.location = l.id
      WHERE i.itemid = '${this.sanitizeSqlValue(sku)}'
        AND l.makeinventoryavailable = 'T'
      ORDER BY l.name
    `
  }

  /**
   * Get item pricing by SKU
   */
  getPricingBySKUQuery(sku: string): string {
    return `
      SELECT
        i.itemid as sku,
        pl.id as pricelevelid,
        pl.name as pricelevelname,
        ip.unitprice,
        c.symbol as currency
      FROM itemprice ip
      JOIN item i ON ip.item = i.id
      JOIN pricelevel pl ON ip.pricelevel = pl.id
      JOIN currency c ON ip.currency = c.id
      WHERE i.itemid = '${this.sanitizeSqlValue(sku)}'
        AND pl.isinactive = 'F'
      ORDER BY pl.name
    `
  }

  /**
   * Get changed records since a specific date
   */
  getChangedRecordsQuery(options: {
    recordType: 'item' | 'customer' | 'salesorder'
    modifiedAfter: Date
    limit: number
  }): string {
    const dateFilter = `lastmodifieddate > TO_DATE('${this.formatDate(options.modifiedAfter)}', 'YYYY-MM-DD HH24:MI:SS')`
    
    switch (options.recordType) {
      case 'item':
        return `
          SELECT id, itemid as externalid, lastmodifieddate
          FROM item
          WHERE ${dateFilter}
          ORDER BY lastmodifieddate ASC
          LIMIT ${options.limit}
        `
      case 'customer':
        return `
          SELECT id, entityid as externalid, lastmodifieddate
          FROM customer
          WHERE ${dateFilter}
          ORDER BY lastmodifieddate ASC
          LIMIT ${options.limit}
        `
      case 'salesorder':
        return `
          SELECT id, tranid as externalid, lastmodifieddate
          FROM salesorder
          WHERE ${dateFilter}
          ORDER BY lastmodifieddate ASC
          LIMIT ${options.limit}
        `
    }
  }

  /**
   * Get item categories
   */
  getCategoriesQuery(): string {
    return `
      SELECT
        id,
        name,
        isinactive,
        description
      FROM itemcategory
      WHERE isinactive = 'F'
      ORDER BY name
    `
  }

  /**
   * Build dynamic query with filters
   */
  buildDynamicQuery(
    table: string,
    fields: string[],
    conditions: Record<string, any>,
    options: {
      orderBy?: string
      limit?: number
      offset?: number
    } = {}
  ): string {
    // Build SELECT clause
    const selectClause = fields.join(', ')
    
    // Build WHERE clause
    const whereConditions = Object.entries(conditions)
      .map(([field, value]) => {
        if (value === null) {
          return `${field} IS NULL`
        } else if (typeof value === 'string') {
          // Sanitize string value
          const sanitizedValue = this.sanitizeSqlValue(value)
          return `${field} = '${sanitizedValue}'`
        } else if (typeof value === 'number') {
          return `${field} = ${value}`
        } else if (typeof value === 'boolean') {
          return `${field} = '${value ? 'T' : 'F'}'`
        } else if (Array.isArray(value)) {
          // Handle IN clause
          const values = value.map(v => 
            typeof v === 'string' ? `'${this.sanitizeSqlValue(v)}'` : v
          ).join(', ')
          return `${field} IN (${values})`
        }
        return ''
      })
      .filter(Boolean)
      .join(' AND ')
    
    // Build query
    let query = `SELECT ${selectClause} FROM ${table}`
    if (whereConditions) {
      query += ` WHERE ${whereConditions}`
    }
    if (options.orderBy) {
      query += ` ORDER BY ${options.orderBy}`
    }
    if (options.limit) {
      query += ` LIMIT ${options.limit}`
    }
    if (options.offset) {
      query += ` OFFSET ${options.offset}`
    }
    
    return query
  }
}