import ExcelJS from 'exceljs';
import { db } from '../../db/index.js'
import {
  and,
  eq,
  gte,
  lte,
  sql, exists, or, isNotNull, isNull, ne, ilike
} from 'drizzle-orm';

import {
  orders,
  orderItems,
  payments,
  variants,
  products,
  colors,
  sizes,
  shipping,
  orderShipping
} from '../../db/schema/index.js';

export async function getShippingReport(req, res) {
  try {
    const {
      status,
      create_gte,
      create_lte,
      payment_image,
      collection,
      awb,
      pickup
    } = req.query;

    console.log('ASEM AWB = ', awb)
    console.log('ASEM PICKUP = ', pickup)


    // =========================================================
    // VALIDASI DATE
    // =========================================================

    let startDate;
    let endDate;

    if (create_gte) {
      startDate = new Date(create_gte);

      if (Number.isNaN(startDate.getTime())) {
        return res.status(400).json({
          status: false,
          message: 'Invalid create_gte'
        });
      }
    }

    if (create_lte) {
      endDate = new Date(create_lte);

      if (Number.isNaN(endDate.getTime())) {
        return res.status(400).json({
          status: false,
          message: 'Invalid create_lte'
        });
      }

      endDate.setHours(23, 59, 59, 999);
    }


    // =========================================================
    // WHERE CONDITION
    // =========================================================

    const conditions = [];

    // =========================================================
    // FILTER PAYMENT STATUS
    // =========================================================

    if (status) {
      conditions.push(
        exists(
          db
            .select({
              id: payments.id
            })
            .from(payments)
            .where(
              and(
                eq(
                  payments.orderId,
                  orders.id
                ),
                eq(
                  payments.status,
                  status
                )
              )
            )
        )
      );
    }


    // =========================================================
    // FILTER CREATED AT
    // =========================================================

    if (startDate) {
      conditions.push(
        gte(
          orders.createdAt,
          startDate
        )
      );
    }

    if (endDate) {
      conditions.push(
        lte(
          orders.createdAt,
          endDate
        )
      );
    }


    // =========================================================
    // FILTER COLLECTION
    // =========================================================

    if (collection) {
      conditions.push(
        exists(
          db
            .select({
              id: orderItems.id
            })
            .from(orderItems)
            .innerJoin(
              variants,
              eq(
                orderItems.variantId,
                variants.id
              )
            )
            .innerJoin(
              products,
              eq(
                variants.productId,
                products.id
              )
            )
            .where(
              and(
                eq(
                  orderItems.orderId,
                  orders.id
                ),
                eq(
                  products.categoryId,
                  collection
                )
              )
            )
        )
      );
    }


    // =========================================================
    // FILTER PAYMENT IMAGE
    // =========================================================

    if (payment_image === 'true') {
      conditions.push(
        exists(
          db
            .select({
              id: payments.id
            })
            .from(payments)
            .where(
              and(
                eq(
                  payments.orderId,
                  orders.id
                ),
                isNotNull(payments.image),
                ne(payments.image, '')
              )
            )
        )
      );
    }

    if (payment_image === 'false') {
      conditions.push(
        exists(
          db
            .select({
              id: payments.id
            })
            .from(payments)
            .where(
              and(
                eq(
                  payments.orderId,
                  orders.id
                ),
                or(
                  isNull(payments.image),
                  eq(payments.image, '')
                )
              )
            )
        )
      );
    }

    if (awb === 'true') {
      conditions.push(
        exists(
          db.select({ id: shipping.id })
            .from(shipping)
            .where(
              and(
                eq(shipping.orderId, orders.id),
                isNotNull(shipping.awb),
                ne(shipping.awb, '')
              )
            )
        )
      )
    } else if (awb === 'false') {
      conditions.push(
        exists(
          db.select({ id: shipping.id })
            .from(shipping)
            .where(
              and(
                eq(shipping.orderId, orders.id),
                or(
                  isNull(shipping.awb),
                  eq(shipping.awb, '')
                )
              )
            )
        )
      )
    }
    
    if (pickup === 'true') {
      conditions.push(
        exists(
          db.select({ id: orderShipping.id })
            .from(orderShipping)
            .where(
              and(
                eq(orderShipping.orderId, orders.id),
                eq(orderShipping.shipping, 'Pickup')
              )
            )
        )
      )
    } else if (pickup === 'false') {
      conditions.push(
        exists(
          db.select({ id: shipping.id })
            .from(shipping)
            .where(
              and(
                eq(shipping.orderId, orders.id),
                ne(orderShipping.shipping, 'Pickup')
              )
            )
        )
      )
    }


    const whereCondition =
      conditions.length > 0
        ? and(...conditions)
        : undefined;


    // =========================================================
    // GET ORDERS
    // =========================================================

    const ordersData = await db.query.orders.findMany({
      where: whereCondition,

      orderBy: (orders, { asc }) => [
        asc(orders.createdAt)
      ],

      with: {
        orderAddress: true
      }
    });


    // =========================================================
    // CREATE EXCEL
    // =========================================================

    const workbook =
      new ExcelJS.Workbook();

    workbook.creator =
      'DIVRSITY';

    workbook.created =
      new Date();


    const worksheet =
      workbook.addWorksheet(
        'Shipping Report'
      );


    // =========================================================
    // HEADER
    // =========================================================

    worksheet.columns = [

      {
        header: 'orderNumber',
        key: 'orderNumber',
        width: 40
      },

      {
        header: 'recipientName',
        key: 'recipientName',
        width: 25
      },

      {
        header: 'phone',
        key: 'phone',
        width: 20
      },

      {
        header: 'address',
        key: 'address',
        width: 30
      },

      {
        header: 'postalCode',
        key: 'postalCode',
        width: 10
      },

      {
        header: 'fullAddress',
        key: 'fullAddress',
        width: 60
      },

      {
        header: 'awbNumber',
        key: 'awbNumber',
        width: 25
      }

    ];


    // =========================================================
    // HEADER STYLE
    // =========================================================

    const headerRow =
      worksheet.getRow(1);

    headerRow.font = {
      bold: true
    };

    headerRow.alignment = {
      vertical: 'middle',
      horizontal: 'center'
    };


    // =========================================================
    // DATA
    // =========================================================

    for (const order of ordersData) {

      const address =
        order.orderAddress;


      worksheet.addRow({

        // Order ID
        orderNumber:
          order.orderNumber || '',

        // Recipient
        recipientName:
          address?.recipientName || '',

        // Phone
        phone:
          address?.phone || '',

        address: address.address,
        postalCode: address.postalCode,

        // Address lengkap
        fullAddress: [
          address?.address,
          address?.subdistrictName,
          address?.districtName,
          address?.cityName,
          address?.provinceName,
          address?.postalCode
        ]
          .filter(Boolean)
          .join(', '),

        // Sengaja kosong
        awbNumber:
          ''

      });

    }


    // =========================================================
    // FORMAT
    // =========================================================

    worksheet.eachRow(
      (row, rowNumber) => {

        row.alignment = {
          vertical: 'top',
          wrapText: true
        };

        if (rowNumber > 1) {

          row.getCell(
            'orderNumber'
          ).alignment = {
            vertical: 'top'
          };

          row.getCell(
            'phone'
          ).alignment = {
            vertical: 'top'
          };

        }

      }
    );


    // =========================================================
    // FREEZE HEADER
    // =========================================================

    worksheet.views = [
      {
        state: 'frozen',
        ySplit: 1
      }
    ];


    // =========================================================
    // AUTO FILTER
    // =========================================================

    worksheet.autoFilter = {
      from: 'A1',
      to: 'E1'
    };


    // =========================================================
    // BORDER
    // =========================================================

    worksheet.eachRow(
      (row) => {

        row.eachCell(
          (cell) => {

            cell.border = {
              top: {
                style: 'thin'
              },
              left: {
                style: 'thin'
              },
              bottom: {
                style: 'thin'
              },
              right: {
                style: 'thin'
              }
            };

          }
        );

      }
    );


    // =========================================================
    // RESPONSE
    // =========================================================

    const filename =
      `shipping-report-${Date.now()}.xlsx`;


    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );


    await workbook.xlsx.write(res);

    res.end();

  } catch (error) {

    console.error(
      'GET SHIPPING REPORT ERROR:',
      error
    );

    return handleError(
      res,
      error
    );

  }
}

export async function getOrderReport(req, res) {
  try {
    const {
      status,
      create_gte,
      create_lte,
      payment_image,
      collection,
      awb,
      pickup
    } = req.query;

    // =========================================================
    // VALIDASI DATE
    // =========================================================

    let startDate;
    let endDate;

    if (create_gte) {
      startDate = new Date(create_gte);

      if (Number.isNaN(startDate.getTime())) {
        return res.status(400).json({
          status: false,
          message: 'Invalid create_gte'
        });
      }
    }

    if (create_lte) {
      endDate = new Date(create_lte);

      if (Number.isNaN(endDate.getTime())) {
        return res.status(400).json({
          status: false,
          message: 'Invalid create_lte'
        });
      }

      endDate.setHours(23, 59, 59, 999);
    }


    // =========================================================
    // WHERE CONDITION
    // =========================================================

    const conditions = [];

    // Filter payment.status
    if (status) {
      conditions.push(
        exists(
          db.select({ id: payments.id })
            .from(payments)
            .where(
              and(
                eq(payments.orderId, orders.id),
                ilike(payments.status, status)
              )
            )
        )
      );
    }

    // createdAt >=
    if (startDate) {
      conditions.push(
        gte(
          orders.createdAt,
          startDate
        )
      );
    }

    // createdAt <=
    if (endDate) {
      conditions.push(
        lte(
          orders.createdAt,
          endDate
        )
      );
    }

    if (collection) {
      conditions.push(
        exists(
          db
            .select()
            .from(orderItems)
            .innerJoin(
              variants,
              eq(orderItems.variantId, variants.id)
            )
            .innerJoin(
              products,
              eq(variants.productId, products.id)
            )
            .where(
              and(
                eq(orderItems.orderId, orders.id),
                eq(products.categoryId, collection)
              )
            )
        )
      );
    }

    // Filter payment.image
    if (payment_image === 'true') {
      conditions.push(
        exists(
          db
            .select()
            .from(payments)
            .where(
              and(
                eq(payments.orderId, orders.id),
                isNotNull(payments.image),
                ne(payments.image, '')
              )
            )
        )
      );
    }

    if (payment_image === 'false') {
      conditions.push(
        exists(
          db
            .select()
            .from(payments)
            .where(
              and(
                eq(payments.orderId, orders.id),
                or(
                  isNull(payments.image),
                  eq(payments.image, '')
                )
              )
            )
        )
      );
    }

    if (awb === 'true') {
      conditions.push(
        exists(
          db.select({ id: shipping.id })
            .from(shipping)
            .where(
              and(
                eq(shipping.orderId, orders.id),
                isNotNull(shipping.awb),
                ne(shipping.awb, '')
              )
            )
        )
      )
    } else if (awb === 'false') {
      conditions.push(
        exists(
          db.select({ id: shipping.id })
            .from(shipping)
            .where(
              and(
                eq(shipping.orderId, orders.id),
                or(
                  isNull(shipping.awb),
                  eq(shipping.awb, '')
                )
              )
            )
        )
      )
    }
    
    if (pickup === 'true') {
      conditions.push(
        exists(
          db.select({ id: orderShipping.id })
            .from(orderShipping)
            .where(
              and(
                eq(orderShipping.orderId, orders.id),
                eq(orderShipping.shipping, 'Pickup')
              )
            )
        )
      )
    } else if (pickup === 'false') {
      conditions.push(
        exists(
          db.select({ id: orderShipping.id })
            .from(orderShipping)
            .where(
              and(
                eq(orderShipping.orderId, orders.id),
                or(
                  ne(orderShipping.shipping, 'Pickup'),
                  isNull(orderShipping.shipping)
                )
              )
            )
        )
      )
    }

    const whereCondition =
      conditions.length > 0
        ? and(...conditions)
        : undefined;

    console.log('WHERE CONDITION = ', whereCondition)
    // =========================================================
    // 1. SUMMARY ORDER
    //
    // HANYA MENGHITUNG DATA LEVEL ORDER
    //
    // Jangan JOIN orderItems di sini karena satu order
    // bisa mempunyai banyak item.
    // =========================================================

    const [orderSummary] = await db
      .select({

        // Jumlah order
        totalOrders: sql`
          COUNT(DISTINCT ${orders.id})
        `,

        // Total discount
        totalDiscount: sql`
          COALESCE(
            SUM(${orders.discount}),
            0
          )
        `,

        // Total shipping
        totalShipping: sql`
          COALESCE(
            SUM(${orders.shippingCost}),
            0
          )
        `,

        // Grand total
        grandTotal: sql`
          COALESCE(
            SUM(${orders.grandTotal}),
            0
          )
        `

      })
      .from(orders)

      .where(whereCondition);


    // =========================================================
    // 2. SUMMARY ITEM
    //
    // HANYA MENGHITUNG DATA LEVEL ITEM
    // =========================================================

    
    const [itemSummary] = await db
      .select({
        totalItems: sql`
          COALESCE(
            SUM(${orderItems.quantity}),
            0
          )
        `,
        grossSales: sql`
          COALESCE(
            SUM(
              ${orderItems.quantity} * ${orderItems.price}
            ),
            0
          )
        `
      })
      .from(orderItems)
      .innerJoin(
        orders,
        eq(orders.id, orderItems.orderId)
      )
      .where(whereCondition);



    // =========================================================
    // 3. GABUNGKAN SUMMARY
    // =========================================================

    const summary = {

      totalOrders:
        Number(orderSummary?.totalOrders || 0),

      totalItems:
        Number(itemSummary?.totalItems || 0),

      grossSales:
        Number(itemSummary?.grossSales || 0),

      totalDiscount:
        Number(orderSummary?.totalDiscount || 0),

      totalShipping:
        Number(orderSummary?.totalShipping || 0),

      grandTotal:
        Number(orderSummary?.grandTotal || 0)

    };


    // =========================================================
    // 4. SALES BY VARIANT
    // =========================================================

    const variantReport = await db
      .select({

        variantId:
          variants.id,

        productName:
          products.name,

        colorName:
          colors.name,

        sizeName:
          sizes.name,

        // Jumlah unit terjual
        qtySold: sql`
          COALESCE(
            SUM(${orderItems.quantity}),
            0
          )
        `,

        // Total penjualan variant
        totalSales: sql`
          COALESCE(
            SUM(
              ${orderItems.quantity}
              * ${orderItems.price}
            ),
            0
          )
        `,

        // Jumlah order yang memiliki variant tersebut
        totalOrders: sql`
          COUNT(
            DISTINCT ${orders.id}
          )
        `

      })

      .from(orderItems)

      .innerJoin(
        orders,
        eq(
          orders.id,
          orderItems.orderId
        )
      )

      .innerJoin(
        variants,
        eq(
          variants.id,
          orderItems.variantId
        )
      )

      .innerJoin(
        products,
        eq(
          products.id,
          variants.productId
        )
      )

      .leftJoin(
        colors,
        eq(
          colors.id,
          variants.colorId
        )
      )

      .leftJoin(
        sizes,
        eq(
          sizes.id,
          variants.sizeId
        )
      )

      .where(whereCondition)

      .groupBy(
        variants.id,
        products.name,
        colors.name,
        sizes.name
      )

      .orderBy(
        sql`
          SUM(
            ${orderItems.quantity}
            * ${orderItems.price}
          ) DESC
        `
      );


    // =========================================================
    // 5. CREATE EXCEL WORKBOOK
    // =========================================================

    const workbook =
      new ExcelJS.Workbook();

    workbook.creator =
      'Divrsity';

    workbook.created =
      new Date();


    // =========================================================
    // SHEET 1 - SUMMARY
    // =========================================================

    const summarySheet =
      workbook.addWorksheet(
        'Summary'
      );


    // =========================================================
    // TITLE
    // =========================================================

    summarySheet.mergeCells(
      'A1:B1'
    );

    summarySheet.getCell(
      'A1'
    ).value =
      'SALES REPORT';

    summarySheet.getCell(
      'A1'
    ).font = {
      bold: true,
      size: 16
    };

    summarySheet.getCell(
      'A1'
    ).alignment = {
      horizontal: 'center'
    };


    // =========================================================
    // FILTER INFORMATION
    // =========================================================

    summarySheet.getCell(
      'A3'
    ).value =
      'Payment Status';

    summarySheet.getCell(
      'B3'
    ).value =
      status || 'All';


    summarySheet.getCell(
      'A4'
    ).value =
      'Created From';

    summarySheet.getCell(
      'B4'
    ).value =
      startDate || 'All';


    summarySheet.getCell(
      'A5'
    ).value =
      'Created To';

    summarySheet.getCell(
      'B5'
    ).value =
      endDate || 'All';


    summarySheet.getCell(
      'A6'
    ).value =
      'AWB';

    summarySheet.getCell(
      'B6'
    ).value =
      awb || 'All';
    
    
      summarySheet.getCell(
      'A7'
    ).value =
      'Pickup';

    summarySheet.getCell(
      'B7'
    ).value =
      pickup || 'All';


    // =========================================================
    // SUMMARY TABLE
    // =========================================================

    summarySheet.getCell(
      'A10'
    ).value =
      'Metric';

    summarySheet.getCell(
      'B10'
    ).value =
      'Value';


    summarySheet.getCell(
      'A11'
    ).value =
      'Total Orders';

    summarySheet.getCell(
      'B11'
    ).value =
      summary.totalOrders;


    summarySheet.getCell(
      'A12'
    ).value =
      'Total Items Sold';

    summarySheet.getCell(
      'B12'
    ).value =
      summary.totalItems;


    summarySheet.getCell(
      'A13'
    ).value =
      'Gross Sales';

    summarySheet.getCell(
      'B13'
    ).value =
      summary.grossSales;


    summarySheet.getCell(
      'A14'
    ).value =
      'Total Discount';

    summarySheet.getCell(
      'B14'
    ).value =
      summary.totalDiscount;


    summarySheet.getCell(
      'A15'
    ).value =
      'Total Shipping';

    summarySheet.getCell(
      'B15'
    ).value =
      summary.totalShipping;


    summarySheet.getCell(
      'A16'
    ).value =
      'Grand Total';

    summarySheet.getCell(
      'B16'
    ).value =
      summary.grandTotal;


    // =========================================================
    // HEADER STYLE
    // =========================================================

    summarySheet.getRow(
      10
    ).font = {
      bold: true
    };


    // =========================================================
    // CURRENCY FORMAT
    // =========================================================

    summarySheet.getCell(
      'B13'
    ).numFmt =
      '"Rp" #,##0';

    summarySheet.getCell(
      'B14'
    ).numFmt =
      '"Rp" #,##0';

    summarySheet.getCell(
      'B15'
    ).numFmt =
      '"Rp" #,##0';

    summarySheet.getCell(
      'B16'
    ).numFmt =
      '"Rp" #,##0';


    // =========================================================
    // WIDTH
    // =========================================================

    summarySheet.getColumn(
      'A'
    ).width = 25;

    summarySheet.getColumn(
      'B'
    ).width = 25;


    // =========================================================
    // SHEET 2 - SALES BY VARIANT
    // =========================================================

    const variantSheet =
      workbook.addWorksheet(
        'Sales by Variant'
      );


    variantSheet.columns = [

      {
        header: 'Variant ID',
        key: 'variantId',
        width: 38
      },

      {
        header: 'Product',
        key: 'productName',
        width: 30
      },

      {
        header: 'Color',
        key: 'colorName',
        width: 20
      },

      {
        header: 'Size',
        key: 'sizeName',
        width: 15
      },

      {
        header: 'Orders',
        key: 'totalOrders',
        width: 12
      },

      {
        header: 'Qty Sold',
        key: 'qtySold',
        width: 15
      },

      {
        header: 'Total Sales',
        key: 'totalSales',
        width: 20
      }

    ];


    // =========================================================
    // INSERT VARIANT DATA
    // =========================================================

    for (const item of variantReport) {

      variantSheet.addRow({

        variantId:
          item.variantId,

        productName:
          item.productName || '-',

        colorName:
          item.colorName || '-',

        sizeName:
          item.sizeName || '-',

        totalOrders:
          Number(
            item.totalOrders || 0
          ),

        qtySold:
          Number(
            item.qtySold || 0
          ),

        totalSales:
          Number(
            item.totalSales || 0
          )

      });

    }


    // =========================================================
    // HEADER
    // =========================================================

    variantSheet.getRow(
      1
    ).font = {
      bold: true
    };

    variantSheet.getRow(
      1
    ).alignment = {
      vertical: 'middle',
      horizontal: 'center'
    };


    // =========================================================
    // CURRENCY
    // =========================================================

    variantSheet
      .getColumn('totalSales')
      .numFmt =
      '"Rp" #,##0';


    // =========================================================
    // FREEZE HEADER
    // =========================================================

    variantSheet.views = [
      {
        state: 'frozen',
        ySplit: 1
      }
    ];

    summarySheet.views = [
      {
        state: 'frozen',
        ySplit: 10
      }
    ];


    // =========================================================
    // AUTO FILTER
    // =========================================================

    variantSheet.autoFilter = {
      from: 'A1',
      to: 'G1'
    };


    // =========================================================
    // GENERATE FILE
    // =========================================================

    const filename =
      `sales-report-${Date.now()}.xlsx`;


    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );


    await workbook.xlsx.write(
      res
    );

    res.end();

  } catch (error) {

    console.error(
      'GET ORDER REPORT ERROR:',
      error
    );

    return handleError(
      res,
      error
    );

  }
}