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

		// Define new rules that give admin full access while maintaining role-specific access
		authRule := "@request.auth.role = 'admin' || (@request.auth.id != '' && @request.auth.role != null)"
		providerRule := "@request.auth.role = 'admin' || @request.auth.role = 'provider'"
		pharmacyRule := "@request.auth.role = 'admin' || @request.auth.role = 'pharmacy'"
		providerOrPharmacyRule := "@request.auth.role = 'admin' || @request.auth.role = 'provider' || @request.auth.role = 'pharmacy'"

		// Update patients collection
		patients, err := dao.FindCollectionByNameOrId("patients")
		if err != nil {
			return err
		}
		patients.CreateRule = types.Pointer(providerRule)
		patients.UpdateRule = types.Pointer(providerRule)
		patients.DeleteRule = types.Pointer(providerRule)
		patients.ListRule = types.Pointer(authRule)
		patients.ViewRule = types.Pointer(authRule)
		if err := dao.SaveCollection(patients); err != nil {
			return err
		}

		// Update encounters collection
		encounters, err := dao.FindCollectionByNameOrId("encounters")
		if err != nil {
			return err
		}
		encounters.CreateRule = types.Pointer(providerRule)
		encounters.UpdateRule = types.Pointer(providerRule)
		encounters.DeleteRule = types.Pointer(providerRule)
		encounters.ListRule = types.Pointer(authRule)
		encounters.ViewRule = types.Pointer(authRule)
		if err := dao.SaveCollection(encounters); err != nil {
			return err
		}

		// Update inventory collection with pharmacy-specific rules
		inventory, err := dao.FindCollectionByNameOrId("inventory")
		if err != nil {
			return err
		}
		// Keep stock validation while adding role checks
		stockRule := "@request.auth.role = 'admin' || (@request.auth.role = 'pharmacy' && @request.data.stock >= 0)"
		inventory.CreateRule = types.Pointer(stockRule)
		inventory.UpdateRule = types.Pointer(stockRule)
		inventory.DeleteRule = types.Pointer(pharmacyRule)
		inventory.ListRule = types.Pointer(authRule)
		inventory.ViewRule = types.Pointer(authRule)
		if err := dao.SaveCollection(inventory); err != nil {
			return err
		}

		// Update disbursements collection
		disbursements, err := dao.FindCollectionByNameOrId("disbursements")
		if err != nil {
			return err
		}
		disbursements.CreateRule = types.Pointer(pharmacyRule)
		disbursements.UpdateRule = types.Pointer(pharmacyRule)
		disbursements.DeleteRule = types.Pointer(providerOrPharmacyRule)
		disbursements.ListRule = types.Pointer(authRule)
		disbursements.ViewRule = types.Pointer(authRule)
		if err := dao.SaveCollection(disbursements); err != nil {
			return err
		}

		// Update queue collection
		queue, err := dao.FindCollectionByNameOrId("queue")
		if err != nil {
			return err
		}
		queue.CreateRule = types.Pointer(providerRule)
		queue.UpdateRule = types.Pointer(authRule) // Allow all authenticated users to update queue status
		queue.DeleteRule = types.Pointer(providerRule)
		queue.ListRule = types.Pointer(authRule)
		queue.ViewRule = types.Pointer(authRule)
		if err := dao.SaveCollection(queue); err != nil {
			return err
		}

		// Update all other collections with base rules
		collections := []string{
			"chief_complaints",
			"encounter_question_categories",
			"encounter_questions",
			"encounter_responses",
			"bulk_distributions",
			"bulk_items",
		}

		for _, name := range collections {
			collection, err := dao.FindCollectionByNameOrId(name)
			if err != nil {
				continue // Skip if collection doesn't exist
			}
			collection.CreateRule = types.Pointer(authRule)
			collection.UpdateRule = types.Pointer(authRule)
			collection.DeleteRule = types.Pointer(providerRule)
			collection.ListRule = types.Pointer(authRule)
			collection.ViewRule = types.Pointer(authRule)
			if err := dao.SaveCollection(collection); err != nil {
				return err
			}
		}

		return nil
	}, func(db dbx.Builder) error {
		// Revert changes - restore original rules
		dao := daos.New(db)

		// Define original rules
		authRule := "@request.auth.id != ''"
		deleteRule := "@request.auth.role = 'provider' || @request.auth.role = 'admin'"
		pharmacyDeleteRule := "@request.auth.role = 'provider' || @request.auth.role = 'admin' || @request.auth.role = 'pharmacy'"

		collections := []string{
			"patients", "encounters", "inventory", "disbursements", "queue",
			"chief_complaints", "encounter_question_categories", "encounter_questions",
			"encounter_responses", "bulk_distributions", "bulk_items",
		}

		for _, name := range collections {
			collection, err := dao.FindCollectionByNameOrId(name)
			if err != nil {
				continue
			}
			collection.CreateRule = types.Pointer(authRule)
			collection.UpdateRule = types.Pointer(authRule)
			collection.DeleteRule = types.Pointer(deleteRule)
			collection.ListRule = types.Pointer(authRule)
			collection.ViewRule = types.Pointer(authRule)
			if err := dao.SaveCollection(collection); err != nil {
				return err
			}
		}

		return nil
	})
}
