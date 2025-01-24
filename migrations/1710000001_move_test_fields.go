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

		// Update patients collection - remove test fields
		patients, err := dao.FindCollectionByNameOrId("patients")
		if err != nil {
			return err
		}

		// Remove test fields from patients
		patients.Schema.RemoveField("urinalysis")
		patients.Schema.RemoveField("blood_sugar")
		patients.Schema.RemoveField("pregnancy_test")

		if err := dao.SaveCollection(patients); err != nil {
			return err
		}

		// Update encounters collection - add test fields and results
		encounters, err := dao.FindCollectionByNameOrId("encounters")
		if err != nil {
			return err
		}

		// Add test fields to encounters
		encounters.Schema.AddField(&schema.SchemaField{
			Name:     "urinalysis",
			Type:     "bool",
			Required: false,
		})
		encounters.Schema.AddField(&schema.SchemaField{
			Name:     "blood_sugar",
			Type:     "bool",
			Required: false,
		})
		encounters.Schema.AddField(&schema.SchemaField{
			Name:     "pregnancy_test",
			Type:     "bool",
			Required: false,
		})

		// Add result fields to encounters
		encounters.Schema.AddField(&schema.SchemaField{
			Name:     "urinalysis_result",
			Type:     "text",
			Required: false,
		})
		encounters.Schema.AddField(&schema.SchemaField{
			Name:     "blood_sugar_result",
			Type:     "text",
			Required: false,
		})
		encounters.Schema.AddField(&schema.SchemaField{
			Name:     "pregnancy_test_result",
			Type:     "text",
			Required: false,
		})

		return dao.SaveCollection(encounters)
	}, func(db dbx.Builder) error {
		dao := daos.New(db)

		// Revert encounters collection changes
		encounters, err := dao.FindCollectionByNameOrId("encounters")
		if err != nil {
			return err
		}

		// Remove test fields and results from encounters
		encounters.Schema.RemoveField("urinalysis")
		encounters.Schema.RemoveField("blood_sugar")
		encounters.Schema.RemoveField("pregnancy_test")
		encounters.Schema.RemoveField("urinalysis_result")
		encounters.Schema.RemoveField("blood_sugar_result")
		encounters.Schema.RemoveField("pregnancy_test_result")

		if err := dao.SaveCollection(encounters); err != nil {
			return err
		}

		// Revert patients collection changes
		patients, err := dao.FindCollectionByNameOrId("patients")
		if err != nil {
			return err
		}

		// Add test fields back to patients
		patients.Schema.AddField(&schema.SchemaField{
			Name:     "urinalysis",
			Type:     "bool",
			Required: false,
		})
		patients.Schema.AddField(&schema.SchemaField{
			Name:     "blood_sugar",
			Type:     "bool",
			Required: false,
		})
		patients.Schema.AddField(&schema.SchemaField{
			Name:     "pregnancy_test",
			Type:     "bool",
			Required: false,
		})

		return dao.SaveCollection(patients)
	})
}
