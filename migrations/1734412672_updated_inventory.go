package migrations

import (
	"encoding/json"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/daos"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/models/schema"
)

func init() {
	m.Register(func(db dbx.Builder) error {
		dao := daos.New(db);

		collection, err := dao.FindCollectionByNameOrId("zmul1jrayt1lpwm")
		if err != nil {
			return err
		}

		// update
		edit_stock := &schema.SchemaField{}
		json.Unmarshal([]byte(`{
			"system": false,
			"id": "hybvd7f7",
			"name": "stock",
			"type": "number",
			"required": false,
			"presentable": false,
			"unique": false,
			"options": {
				"min": null,
				"max": null,
				"noDecimal": false
			}
		}`), edit_stock)
		collection.Schema.AddField(edit_stock)

		return dao.SaveCollection(collection)
	}, func(db dbx.Builder) error {
		dao := daos.New(db);

		collection, err := dao.FindCollectionByNameOrId("zmul1jrayt1lpwm")
		if err != nil {
			return err
		}

		// update
		edit_stock := &schema.SchemaField{}
		json.Unmarshal([]byte(`{
			"system": false,
			"id": "hybvd7f7",
			"name": "stock",
			"type": "number",
			"required": true,
			"presentable": false,
			"unique": false,
			"options": {
				"min": null,
				"max": null,
				"noDecimal": false
			}
		}`), edit_stock)
		collection.Schema.AddField(edit_stock)

		return dao.SaveCollection(collection)
	})
}
