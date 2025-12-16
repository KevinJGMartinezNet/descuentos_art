/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope Public
 * @Author Kevin Jesús González Martínez
 * @CreatedDate 2025-08-15
 * @Version 1.0.0
 * @Project Reporte: Movimiento de costos relacionado al modulo de descuento.
 * @Category Inventario / Tipo de registro
 * @Description Reporte: Este proyecto sirve para poder poner descuentos a los artículos dentro del catalogo de artículos.
 *
 * @ReviewedBy KEVIN JESUS GONZALEZ MARTINEZ 
 * @ApprovedBy CARLOS AUGUSTO FUENTES PEÑA
 *
 * @LastModified 2025-12-16
 * @LastModifiedBy Kevin Jesús González Martínez
 *
 * @ChangeLog
 *    - 2025-08-15 | Kevin J. González | v1.0.0 | Creación del modulo y desarrollo con los parametros que me asignaron en el requerimiento.
 *
 */
define(['N/search', 'N/record', 'N/log'], function (search, record, log) {

    function afterSubmit(context) {
        try {
            var newRecord = context.newRecord;
            var itemId    = newRecord.id;
            var itemType  = newRecord.type;

            var precioListaRaw = newRecord.getValue('custitem_precio_lista') || '';
            var precioLista = parseFloat(String(precioListaRaw).toString().replace(/[^0-9.\-]/g,'')) || 0;

            // Comentario por Kevin: 19/08/2025 --> Si el campo precio de lista es vacío o 0, resetean los campos de los custitem.
            if (precioLista === 0 || precioLista === '') {
                record.submitFields({
                    type: itemType,
                    id: itemId,
                    values: {
                        custitem_costo_siva: 0,
                        custitem_costo_neto: 0,
                        custitem_factor: 0
                    },
                    options: { ignoreMandatoryFields: true }
                });
                log.audit('afterSubmit', 'Precio de lista = 0: costos y factor reseteados a 0');
                return;
            }

            // Comentario por Kevin: 19/08/2025 --> Estas variables nos ayudan hacer el descuento en cascada.
            var precioFinal = precioLista;

            var descuentoSearch = search.create({
                type: 'customrecord_descuento_articulos',
                filters: [
                            ['custrecord_articulo_padre', 'anyof', itemId],
                            'AND', 
                            ['isinactive', 'is', 'F']
                        ],
                columns: [
                            'internalid',
                            'custrecord_porcentaje_descuento'
                        ]
            });

            descuentoSearch.run().each(function (result) {
                var pct = parseFloat(result.getValue('custrecord_porcentaje_descuento')) || 0;
                precioFinal = precioFinal * (1 - (pct / 100));

                record.submitFields({
                    type: 'customrecord_descuento_articulos',
                    id: result.id,
                    values: { custrecord_valor_aplicado: Number(precioFinal.toFixed(2)) },
                    options: { ignoreMandatoryFields: true }
                });

                return true;
            });

            //  Comentario por Kevin: 19/08/2025 --> Después de tener los datos en cascada hace el cálculo en las variables de los custitem y después se los pasamos directamente, se le tiene que quitar el fixed porque el dato tiene que llevar muchos decimales, si no, no cuadra con las ordenes de compra.
            var costoSiva  = precioFinal;
            var costoNeto  = costoSiva * 1.16;
            var factor     = ((costoSiva / precioLista) - 1) * (-100); 

            record.submitFields({
                type: itemType,
                id: itemId,
                values: {
                    //custitem_costo_siva: Number(costoSiva.toFixed(2)),
                    custitem_costo_siva: Number(costoSiva),
                    custitem_costo_neto: Number(costoNeto.toFixed(2)),
                    custitem_factor: Number(factor.toFixed(2))
                },
                options: { ignoreMandatoryFields: true }
            });

            // Comentario por Kevin: 19/08/2025 --> NUEVO: copiar a 'cost' sólo si custitem_costo_siva > 0 se tuvo que poner varios intentos para poder mandar el valor al costo, ya que tiene candados, por ende, se busco la documentación para poderlo hacer directo dependiendo si es STANDARD, AVGCOTS, FIFO, LIFO y etc. por ahora el que funciono fue el STANDARD y es el que se uso en esta lógica, ya que antes no se podía guardar aunque le dabamos el valor.
            if (costoSiva > 0) {
                try {
                    record.submitFields({
                        type: itemType,
                        id: itemId,
                        values: { cost: Number(costoSiva) },
                        options: { ignoreMandatoryFields: true }
                    });
                    log.audit('Costo actualizado', 'Se escribió en field "cost": ' + costoSiva);
                } catch (e1) {
                    var costingMethod = newRecord.getValue('costingmethod'); // STANDARD, AVGCOST, FIFO, LIFO, etc.
                    log.debug('No se pudo escribir en cost; método de costeo', costingMethod);

                    try {
                        if (String(costingMethod).toUpperCase() === 'STANDARD') {
                            record.submitFields({
                                type: itemType,
                                id: itemId,
                                values: { standardcost: Number(costoSiva) },
                                options: { ignoreMandatoryFields: true }
                            });
                            log.audit('Costo actualizado', 'Se escribió en "standardcost": ' + costoSiva);
                        } else {
                            record.submitFields({
                                type: itemType,
                                id: itemId,
                                values: { purchaseprice: Number(costoSiva) },
                                options: { ignoreMandatoryFields: true }
                            });
                            log.audit('Costo actualizado', 'Se escribió en "purchaseprice": ' + costoSiva);
                        }
                    } catch (e2) {
                        log.error('No fue posible actualizar costo estándar/compra', e2);
                    }
                }
            } else {
                log.audit('Costo no copiado', 'custitem_costo_siva es <= 0; no se actualiza "cost".');
            }

            log.audit('afterSubmit cascade', {
                itemId: itemId,
                precioLista: precioLista,
                costoSiva: costoSiva,
                costoNeto: costoNeto,
                factor: factor
            });

        } catch (e) {
            log.error('Error afterSubmit cascade', e);
        }
    }

    return { afterSubmit: afterSubmit };
});


