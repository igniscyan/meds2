package migrations

import (
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/daos"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/tools/types"
)

func init() {
	m.Register(func(db dbx.Builder) error {
		dao := daos.New(db)

		// Add delete rule for patients
		patients, err := dao.FindCollectionByNameOrId("patients")
		if err != nil {
			return err
		}
		patients.DeleteRule = types.Pointer("@request.auth.role = 'provider' || @request.auth.role = 'admin'")
		if err := dao.SaveCollection(patients); err != nil {
			return err
		}

		// Add delete rule for encounters
		encounters, err := dao.FindCollectionByNameOrId("encounters")
		if err != nil {
			return err
		}
		encounters.DeleteRule = types.Pointer("@request.auth.role = 'provider' || @request.auth.role = 'admin'")
		if err := dao.SaveCollection(encounters); err != nil {
			return err
		}

		// Add delete rule for disbursements
		disbursements, err := dao.FindCollectionByNameOrId("disbursements")
		if err != nil {
			return err
		}
		disbursements.DeleteRule = types.Pointer("@request.auth.role = 'provider' || @request.auth.role = 'admin'")
		if err := dao.SaveCollection(disbursements); err != nil {
			return err
		}

		// Add delete rule for encounter_responses
		responses, err := dao.FindCollectionByNameOrId("encounter_responses")
		if err != nil {
			return err
		}
		responses.DeleteRule = types.Pointer("@request.auth.role = 'provider' || @request.auth.role = 'admin'")
		if err := dao.SaveCollection(responses); err != nil {
			return err
		}

		// Add delete rule for queue
		queue, err := dao.FindCollectionByNameOrId("queue")
		if err != nil {
			return err
		}
		queue.DeleteRule = types.Pointer("@request.auth.role = 'provider' || @request.auth.role = 'admin'")
		if err := dao.SaveCollection(queue); err != nil {
			return err
		}

		return nil
	}, func(db dbx.Builder) error {
		// Revert changes
		dao := daos.New(db)

		collections := []string{"patients", "encounters", "disbursements", "encounter_responses", "queue"}
		for _, name := range collections {
			collection, err := dao.FindCollectionByNameOrId(name)
			if err != nil {
				return err
			}
			collection.DeleteRule = nil
			if err := dao.SaveCollection(collection); err != nil {
				return err
			}
		}

		return nil
	})
}
