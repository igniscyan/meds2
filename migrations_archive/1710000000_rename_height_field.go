package migrations

import (
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/daos"
	m "github.com/pocketbase/pocketbase/migrations"
)

func init() {
	m.Register(func(db dbx.Builder) error {
		dao := daos.New(db)

		// Rename height_inches to height in encounters collection
		collection, err := dao.FindCollectionByNameOrId("encounters")
		if err != nil {
			return err
		}

		// Find the height_inches field
		for _, field := range collection.Schema.Fields() {
			if field.Name == "height_inches" {
				field.Name = "height"
				break
			}
		}
		return dao.SaveCollection(collection)
	}, func(db dbx.Builder) error {
		dao := daos.New(db)

		// Revert: rename height back to height_inches in encounters collection
		collection, err := dao.FindCollectionByNameOrId("encounters")
		if err != nil {
			return err
		}

		// Find the height field
		for _, field := range collection.Schema.Fields() {
			if field.Name == "height" {
				field.Name = "height_inches"
				break
			}
		}

		return dao.SaveCollection(collection)
	})
}
