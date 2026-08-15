migrate(
  (app) => {
    const listas = app.findCollectionByNameOrId('listas')
    const hasIdade = listas.fields.some((f) => f.name === 'idade_min_anos')
    if (!hasIdade) {
      listas.fields.add(
        new NumberField({
          name: 'idade_min_anos',
          required: false,
          min: 0,
          max: 200,
          onlyInt: true,
        }),
      )
    }
    app.save(listas)

    // default 3 anos nas listas existentes
    const registros = app.findRecordsByFilter('listas', 'idade_min_anos = null', '', 0, 0)
    for (const r of registros) {
      r.set('idade_min_anos', 3)
      app.save(r)
    }
  },
  (app) => {
    const listas = app.findCollectionByNameOrId('listas')
    const remove = listas.fields.filter((f) => f.name === 'idade_min_anos')
    for (const f of remove) {
      listas.fields.remove(f.id)
    }
    app.save(listas)
  },
)
