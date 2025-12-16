/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope Public
 * @Author Kevin Jesús González Martínez
 * @CreatedDate 2025-08-28
 * @Version 1.0.2
 * @Project Reporte: Movimiento de costos relacionado al modulo de descuento.
 * @Category Inventario / Tipo de registro
 * @Description Reporte: Este proyecto sirve para poder poner descuentos a los artículos dentro del catalogo de artículos, además que apoya a mandar correo electrónico, archivo CSV, y avisa al usuario cuando termina el descuento.
 *
 * @ReviewedBy KEVIN JESUS GONZALEZ MARTINEZ 
 * @ApprovedBy CARLOS AUGUSTO FUENTES PEÑA
 *
 * @LastModified 2025-12-16
 * @LastModifiedBy Kevin Jesús González Martínez
 *
 * @ChangeLog
 *    - 2025-12-15 | Kevin J. González | v1.0.0 | Hacer el recálculo cuando termina el descuento.
 *    - 2025-12-15 | Kevin J. González | v1.0.1 | Desarrollo de notificación por correo electrónico.
 *    - 2025-12-15 | Kevin J. González | v1.0.2 | Desarrollo de archivo CSV, para que lo tengan como referencia y descarga.
 */
define([
    'N/search',
    'N/record',
    'N/log',
    'N/format',
    'N/email',
    'N/file'
], function (search, record, log, format, email, file) {

    function execute(context) {

        try {
            // Fecha de hoy
            var hoy = format.format({
                value: new Date(),
                type: format.Type.DATE
            });

            var articulosARecalcular = {};
            var filasCorreo = [];

            // ===============================
            // 1. Buscar descuentos vencidos
            // ===============================
            var descuentoSearch = search.create({
                type: 'customrecord_descuento_articulos',
                filters: [
                    ['custrecord_fecha_fin', 'onorbefore', hoy],
                    'AND',
                    ['isinactive', 'is', 'F']
                ],
                columns: [
                    'internalid',
                    'custrecord_articulo_padre',
                    'custrecord_tipo_descuento',
                    'custrecord_porcentaje_descuento',
                    'custrecord_descuento_notas',
                    'custrecord_valor_aplicado',
                    'custrecord_fecha_fin'
                ]
            });

            descuentoSearch.run().each(function (result) {

                var descuentoId = result.getValue('internalid');
                var articuloId  = result.getValue('custrecord_articulo_padre');
                var porcentajeDescuento = parseFloat(result.getValue('custrecord_porcentaje_descuento')) || 0;

                if (articuloId) {
                    var itemLookup = search.lookupFields({
                        type: search.Type.ITEM,
                        id: articuloId,
                        columns: ['displayname', 'itemid', 'custitem_costo_siva', 'custitem_precio_lista']
                    });

                    var precioLista = parseFloat(itemLookup.custitem_precio_lista) || 0;
                    
                    var valorAplicado = (precioLista * porcentajeDescuento);

                    record.submitFields({
                        type: 'customrecord_descuento_articulos',
                        id: descuentoId,
                        values: { 
                            isinactive: true,
                            custrecord_valor_aplicado: valorAplicado.toFixed(2)
                        },
                        options: { ignoreMandatoryFields: true }
                    });

                    articulosARecalcular[articuloId] = true;

                    filasCorreo.push({
                        descuentoId: descuentoId,
                        articuloId: articuloId,
                        displayname: itemLookup.displayname || '',
                        itemid: itemLookup.itemid || '',
                        tipo: result.getText('custrecord_tipo_descuento') || 'N/A',
                        descuento: porcentajeDescuento,
                        fechaFin: result.getValue('custrecord_fecha_fin'),
                        precioAnterior: itemLookup.custitem_costo_siva || 0,
                        precioNuevo: 0,
                        valorAplicado: valorAplicado,
                        descuento_notas: result.getValue('custrecord_descuento_notas') || ''
                    });
                }

                return true;
            });

            // ===============================
            // 2. Obtener tipo de artículo
            // ===============================
            function getItemType(itemId) {
                var lookup = search.lookupFields({
                    type: search.Type.ITEM,
                    id: itemId,
                    columns: ['recordtype']
                });
                return lookup.recordtype || null;
            }

            // ===============================
            // 3. Recalcular artículos Y descuentos activos
            // ===============================
            Object.keys(articulosARecalcular).forEach(function (artId) {

                var itemType = getItemType(artId);
                if (!itemType) return;

                // Buscar descuentos activos para este artículo
                var descuentoActivoSearch = search.create({
                    type: 'customrecord_descuento_articulos',
                    filters: [
                        ['custrecord_articulo_padre', 'is', artId],
                        'AND',
                        ['isinactive', 'is', 'F'],
                        'AND',
                        ['custrecord_fecha_fin', 'onorafter', hoy]
                    ],
                    columns: [
                        search.createColumn({
                            name: 'custrecord_porcentaje_descuento',
                            sort: search.Sort.DESC
                        }),
                        'internalid'
                    ]
                });

                var descuentoAplicar = 0;
                var descuentoActivoId = null;

                descuentoActivoSearch.run().each(function (res) {
                    descuentoAplicar = parseFloat(res.getValue('custrecord_porcentaje_descuento')) || 0;
                    descuentoActivoId = res.getValue('internalid');
                    return false; // solo el mayor
                });

                var lookupLista = search.lookupFields({
                    type: itemType,
                    id: artId,
                    columns: ['custitem_precio_lista']
                });

                var precioLista = parseFloat(lookupLista.custitem_precio_lista) || 0;
                var precioNuevo = precioLista;
                var nuevoValorAplicado = 0;

                if (descuentoAplicar > 0) {
                    precioNuevo = precioLista - (precioLista * descuentoAplicar / 100);
                    
                    nuevoValorAplicado = precioLista * ((100 - descuentoAplicar) / 100);

                    if (descuentoActivoId) {
                        record.submitFields({
                            type: 'customrecord_descuento_articulos',
                            id: descuentoActivoId,
                            values: { 
                                custrecord_valor_aplicado: nuevoValorAplicado.toFixed(2)
                            },
                            options: { ignoreMandatoryFields: true }
                        });
                    }
                }

                record.submitFields({
                    type: itemType,
                    id: artId,
                    values: {
                        custitem_costo_siva: precioNuevo,
                        cost: precioNuevo
                    },
                    options: { ignoreMandatoryFields: true }
                });

                filasCorreo.forEach(function (f) {
                    if (f.articuloId === artId) {
                        f.precioNuevo = precioNuevo;
                    }
                });

                log.audit('Recalculo completado', 
                    'Artículo: ' + artId + 
                    ' | Precio Lista: $' + precioLista + 
                    ' | Descuento: ' + descuentoAplicar + '%' +
                    ' | Valor Aplicado: $' + nuevoValorAplicado.toFixed(2) +
                    ' | Precio Nuevo: $' + precioNuevo.toFixed(2)
                );
            });

            // ===============================
            // 4. SOLO enviar correo si hubo cambios
            // ===============================
            if (filasCorreo.length === 0) {
                log.audit('Sin cambios', 'No hubo descuentos vencidos');
                return;
            }

            // ===============================
            // 5. Crear CSV (con valor aplicado)
            // ===============================
            var csv = 'ID,Display Name,Item ID,Tipo Descuento,Descuento,Valor Aplicado,Vigencia,Precio Anterior,Precio Nuevo,Nota\n';

            filasCorreo.forEach(function (f) {
                csv += [
                    f.descuentoId,
                    '"' + f.displayname + '"',
                    f.itemid,
                    f.tipo,
                    f.descuento,
                    f.valorAplicado.toFixed(2),
                    f.fechaFin,
                    f.precioAnterior,
                    f.precioNuevo.toFixed(2),
                    '"' + f.descuento_notas + '"'
                ].join(',') + '\n';
            });

            var csvFile = file.create({
                name: 'descuentos_vencidos_' + hoy + '.csv',
                fileType: file.Type.CSV,
                contents: csv,
                folder: 82043 
            });

            var fileId = csvFile.save();

            // ===============================
            // 6. Construir HTML Profesional (con valor aplicado)
            // ===============================
            var filasHtml = '';

            filasCorreo.forEach(function (f) {
                filasHtml +=
                    '<tr>' +
                    '<td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">' + f.descuentoId + '</td>' +
                    '<td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">' + f.displayname + '</td>' +
                    '<td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">' + f.itemid + '</td>' +
                    '<td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">' + f.tipo + '</td>' +
                    '<td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: center;">' + f.descuento + '%</td>' +
                    '<td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: right; color: #d32f2f;">$' + f.valorAplicado.toFixed(2) + '</td>' +
                    '<td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: center;">' + f.fechaFin + '</td>' +
                    '<td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: right;">$' + parseFloat(f.precioAnterior).toFixed(2) + '</td>' +
                    '<td style="padding: 12px; border-bottom: 1px solid #e0e0e0; text-align: right; font-weight: bold; color: #2e7d32;">$' + parseFloat(f.precioNuevo).toFixed(2) + '</td>' +
                    '<td style="padding: 12px; border-bottom: 1px solid #e0e0e0;">' + f.descuento_notas + '</td>' +
                    '</tr>';
            });

            var cuerpoCorreo =
                '<!DOCTYPE html>' +
                '<html lang="es">' +
                '<head>' +
                '<meta charset="UTF-8">' +
                '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
                '</head>' +
                '<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f5f5f5;">' +
                
                '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f5f5f5; padding: 20px 0;">' +
                '<tr>' +
                '<td align="center">' +
                
                '<table width="900" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">' +
                
                '<tr>' +
                '<td style="background: linear-gradient(135deg, #1976d2 0%, #1565c0 100%); padding: 30px; border-radius: 8px 8px 0 0;">' +
                '<h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Notificación de Descuentos Vencidos</h1>' +
                '<p style="margin: 8px 0 0 0; color: #ffffffff; font-size: 14px;">Sistema Automatizado NetSuite</p>' +
                '</td>' +
                '</tr>' +
                
                '<tr>' +
                '<td style="padding: 30px;">' +
                
                '<p style="margin: 0 0 20px 0; color: #333333; font-size: 15px; line-height: 1.6;">Buen día,</p>' +
                '<p style="margin: 0 0 25px 0; color: #555555; font-size: 14px; line-height: 1.6;">' +
                'Se informa que el proceso automático de <strong>desactivación de descuentos vencidos</strong> se ejecutó correctamente el día de hoy <strong>' + hoy + '</strong>.' +
                '</p>' +
                
                '<div style="background-color: #e3f2fd; border-left: 4px solid #1976d2; padding: 15px; margin-bottom: 25px; border-radius: 4px;">' +
                '<p style="margin: 0; color: #1565c0; font-size: 14px; font-weight: 600;">Resumen de la operación:</p>' +
                '<p style="margin: 8px 0 0 0; color: #424242; font-size: 14px;">Total de descuentos desactivados: <strong>' + filasCorreo.length + '</strong></p>' +
                '<p style="margin: 4px 0 0 0; color: #424242; font-size: 14px;">Artículos actualizados: <strong>' + Object.keys(articulosARecalcular).length + '</strong></p>' +
                '</div>' +
                
                '<h2 style="margin: 0 0 15px 0; color: #333333; font-size: 18px; font-weight: 600; border-bottom: 2px solid #1976d2; padding-bottom: 10px;">Detalle de Descuentos Procesados</h2>' +
                
                '<div style="overflow-x: auto;">' +
                '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #e0e0e0; border-radius: 4px; overflow: hidden;">' +
                
                '<thead>' +
                '<tr style="background: linear-gradient(180deg, #f5f5f5 0%, #eeeeee 100%);">' +
                '<th style="padding: 14px 12px; text-align: left; font-size: 13px; font-weight: 600; color: #424242; border-bottom: 2px solid #bdbdbd;">ID</th>' +
                '<th style="padding: 14px 12px; text-align: left; font-size: 13px; font-weight: 600; color: #424242; border-bottom: 2px solid #bdbdbd;">Display Name</th>' +
                '<th style="padding: 14px 12px; text-align: left; font-size: 13px; font-weight: 600; color: #424242; border-bottom: 2px solid #bdbdbd;">Item ID</th>' +
                '<th style="padding: 14px 12px; text-align: left; font-size: 13px; font-weight: 600; color: #424242; border-bottom: 2px solid #bdbdbd;">Tipo</th>' +
                '<th style="padding: 14px 12px; text-align: center; font-size: 13px; font-weight: 600; color: #424242; border-bottom: 2px solid #bdbdbd;">Descuento</th>' +
                '<th style="padding: 14px 12px; text-align: right; font-size: 13px; font-weight: 600; color: #424242; border-bottom: 2px solid #bdbdbd;">Valor Aplicado</th>' +
                '<th style="padding: 14px 12px; text-align: center; font-size: 13px; font-weight: 600; color: #424242; border-bottom: 2px solid #bdbdbd;">Vigencia</th>' +
                '<th style="padding: 14px 12px; text-align: right; font-size: 13px; font-weight: 600; color: #424242; border-bottom: 2px solid #bdbdbd;">Precio Anterior</th>' +
                '<th style="padding: 14px 12px; text-align: right; font-size: 13px; font-weight: 600; color: #424242; border-bottom: 2px solid #bdbdbd;">Precio Actual</th>' +
                '<th style="padding: 14px 12px; text-align: left; font-size: 13px; font-weight: 600; color: #424242; border-bottom: 2px solid #bdbdbd;">Notas</th>' +
                '</tr>' +
                '</thead>' +
                
                '<tbody style="font-size: 13px; color: #424242;">' +
                filasHtml +
                '</tbody>' +
                
                '</table>' +
                '</div>' +
                
                '<div style="background-color: #fff3e0; border-left: 4px solid #ff9800; padding: 15px; margin-top: 25px; border-radius: 4px;">' +
                '<p style="margin: 0; color: #e65100; font-size: 13px; font-weight: 600;">Archivo Adjunto</p>' +
                '<p style="margin: 8px 0 0 0; color: #424242; font-size: 13px;">Se adjunta archivo CSV con el detalle completo de los descuentos procesados para su registro y análisis.</p>' +
                '</div>' +
                
                '</td>' +
                '</tr>' +
                
                '<tr>' +
                '<td style="background-color: #f5f5f5; padding: 25px; border-radius: 0 0 8px 8px; border-top: 1px solid #e0e0e0;">' +
                '<p style="margin: 0 0 5px 0; color: #666666; font-size: 13px;">Saludos cordiales,</p>' +
                '<p style="margin: 0 0 20px 0; color: #1976d2; font-size: 14px; font-weight: 600;">Sistema NetSuite - FERREPACIFICO</p>' +
                
                '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 1px solid #e0e0e0; padding-top: 15px;">' +
                '<tr>' +
                '<td style="font-size: 11px; color: #999999; line-height: 1.5;">' +
                '<p style="margin: 0 0 5px 0;"><strong>Nota:</strong> Este es un correo automático generado por el sistema.</p>' +
                '<p style="margin: 0;">Si tiene alguna pregunta o requiere información adicional, por favor contacte al departamento de TI.</p>' +
                '</td>' +
                '</tr>' +
                '</table>' +
                
                '</td>' +
                '</tr>' +
                
                '</table>' +
                
                '</td>' +
                '</tr>' +
                '</table>' +
                
                '</body>' +
                '</html>';

            // ===============================
            // 7. Enviar correo
            // ===============================
            email.send({
                author: 66544,
                recipients: ['desarrollador@ferrepacifico.com.mx','gtecompras@ferrepacifico.com.mx','compras11@ferrepacifico.com.mx','compras3@ferrepacifico.com.mx'],
                subject: 'Notificación de Descuentos Vencidos - ' + hoy,
                body: cuerpoCorreo,
                attachments: [file.load({ id: fileId })]
            });

            log.audit('Proceso completado', 'Correo enviado correctamente con ' + filasCorreo.length + ' descuentos procesados');

        } catch (e) {
            log.error('Error ScheduledScript', e);
        }
    }

    return {
        execute: execute
    };

});
