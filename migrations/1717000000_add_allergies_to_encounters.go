package migrations

import (
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/daos"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/models/schema"
)

func init() {
	m.Register(func(db dbx.Builder) error {
		dao := daos.New(db)

		// Get the encounters collection
		collection, err := dao.FindCollectionByNameOrId("encounters")
		if err != nil {
			return err
		}

		// Add allergies field if it doesn't exist
		if collection.Schema.GetFieldByName("allergies") == nil {
			collection.Schema.AddField(&schema.SchemaField{
				Name:     "allergies",
				Type:     "text",
				Required: false,
			})

			return dao.SaveCollection(collection)
		}

		return nil
	}, func(db dbx.Builder) error {
		dao := daos.New(db)

		// Get the encounters collection
		collection, err := dao.FindCollectionByNameOrId("encounters")
		if err != nil {
			return err
		}

		// Remove allergies field if it exists
		field := collection.Schema.GetFieldByName("allergies")
		if field != nil {
			collection.Schema.RemoveField(field.Id)
			return dao.SaveCollection(collection)
		}

		return nil
	})
}
