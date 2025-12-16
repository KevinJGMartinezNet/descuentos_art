/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @Author Kevin Jesús González Martínez
 * @CreatedDate 2025-08-15
 * @Version 1.0.0
 * @Project Reporte: Modulo de descuento, Backend.
 * @Category Inventario / Tipo de registro
 * @Description Reporte: Este proyecto sirve para poder poner descuentos a los artículos dentro del catalogo de artículos, además que este apoya a ver la operación a tiempo real cuando se ponen los descuentos.
 *
 * @ReviewedBy KEVIN JESUS GONZALEZ MARTINEZ 
 * @ApprovedBy CARLOS AUGUSTO FUENTES PEÑA
 *
 * @LastModified 2025-12-16
 * @LastModifiedBy Kevin Jesús González Martínez
 *
 * @ChangeLog
 *    - 2025-08-15 | Kevin J. González | v1.0.0 | Creación del modulo y desarrollo con los parametros que me asignaron en el requerimiento.
 */
define(['N/search', 'N/currentRecord'], function(search, currentRecord) {

    function recalcularValor(scriptContext) {
        try {
            var rec = scriptContext.currentRecord;
            
            var articuloId = rec.getValue('id');
            var porcentaje = parseFloat(rec.getValue('custrecord_porcentaje_descuento')) || 0;
            var pera = rec.setValue('custrecord_porcentaje_descuento');
            console.log(pera,'pera');

            console.log('Artículo Padre ID:', articuloId);
            console.log('Porcentaje:', porcentaje);

            if (!articuloId || porcentaje <= 0) {
                console.log('No hay datos suficientes');
                rec.setValue({
                    fieldId: 'custrecord_valor_aplicado',
                    value: '',
                    ignoreFieldChange: true
                });
                return;
            }

            var itemData = search.lookupFields({
                type: search.Type.ITEM,
                id: articuloId,
                columns: ['custitem_precio_lista']
            });

            console.log('Datos del artículo:', itemData);

            var precioListaRaw = itemData.custitem_precio_lista || '';
            var precioLista = parseFloat(
                String(precioListaRaw).replace(/[^0-9.\-]/g, '')
            ) || 0;

            console.log('Precio Lista:', precioLista);

            if (precioLista > 0) {
                var valorAplicado = precioLista * (porcentaje / 100);

                console.log('Valor Aplicado calculado:', valorAplicado.toFixed(2));

                rec.setValue({
                    fieldId: 'custrecord_valor_aplicado',
                    value: valorAplicado.toFixed(2),
                    ignoreFieldChange: true
                });

                console.log('✅ Valor aplicado actualizado en tiempo real');

            } else {
                console.log('⚠️ Precio lista es 0 o inválido');
                rec.setValue({
                    fieldId: 'custrecord_valor_aplicado',
                    value: '',
                    ignoreFieldChange: true
                });
            }

        } catch (e) {
            console.error('❌ Error en recalcularValor:', e.message);
            console.error(e.stack);
        }
    }

    function fieldChanged(scriptContext) {
        console.log('Campo cambiado:', scriptContext.fieldId);

        if (
            scriptContext.fieldId === 'custrecord_porcentaje_descuento' ||
            scriptContext.fieldId === 'id'
        ) {
            console.log('Campo válido detectado, recalculando...');
            recalcularValor(scriptContext);
        }
    }

    function pageInit(scriptContext) {
        console.log('=== PAGE INIT - Registro de Descuento ===');
        console.log('Modo:', scriptContext.mode);

        if (scriptContext.mode === 'create' || scriptContext.mode === 'edit') {
            var rec = scriptContext.currentRecord;
            var articuloId = rec.getValue('id');
            var porcentaje = rec.getValue('custrecord_porcentaje_descuento');

            console.log('Artículo inicial:', articuloId);
            console.log('Porcentaje inicial:', porcentaje);

            if (articuloId && porcentaje) {
                console.log('Recalculando en pageInit...');
                recalcularValor(scriptContext);
            }
        }
    }

    return {
        pageInit: pageInit,
        fieldChanged: fieldChanged
    };

});
