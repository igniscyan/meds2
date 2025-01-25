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

		// Update patients collection - add pregnancy_status field
		patients, err := dao.FindCollectionByNameOrId("patients")
		if err != nil {
			return err
		}

		// Add pregnancy_status field
		patients.Schema.AddField(&schema.SchemaField{
			Name:     "pregnancy_status",
			Type:     "select",
			Required: false,
			Options: &schema.SelectOptions{
				MaxSelect: 1,
				Values: []string{
					"yes",
					"no",
					"potentially",
				},
			},
		})

		if err := dao.SaveCollection(patients); err != nil {
			return err
		}

		return nil
	}, func(db dbx.Builder) error {
		dao := daos.New(db)

		// Revert patients collection changes
		patients, err := dao.FindCollectionByNameOrId("patients")
		if err != nil {
			return err
		}

		// Remove pregnancy_status field
		patients.Schema.RemoveField("pregnancy_status")

		return dao.SaveCollection(patients)
	})
}
