package migrations

import (
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/daos"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/models/schema"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	m.Register(func(db dbx.Builder) error {
		dao := daos.New(db)

		collection, err := dao.FindCollectionByNameOrId("encounters")
		if err != nil {
			return err
		}
		// Update chief_complaint field to be required
		collection.Schema.SetField("chief_complaint", &schema.SchemaField{
			Name:     "chief_complaint",
			Type:     "relation",
			Required: true,
			Options: &schema.RelationOptions{
				CollectionId: "chief_complaints",
				MaxSelect:    types.Pointer(1),
			},
		})

		return dao.SaveCollection(collection)
	}, func(db dbx.Builder) error {
		dao := daos.New(db)

		collection, err := dao.FindCollectionByNameOrId("encounters")
		if err != nil {
			return err
		}
		// Revert chief_complaint field to not required
		collection.Schema.SetField("chief_complaint", &schema.SchemaField{
			Name:     "chief_complaint",
			Type:     "relation",
			Required: false,
			Options: &schema.RelationOptions{
				CollectionId: "chief_complaints",
				MaxSelect:    types.Pointer(1),
			},
		})

		return dao.SaveCollection(collection)
	})
}
