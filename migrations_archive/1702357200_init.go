package migrations

import (
	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/daos"
	m "github.com/pocketbase/pocketbase/migrations"
	"github.com/pocketbase/pocketbase/models"
	"github.com/pocketbase/pocketbase/models/schema"
)

func init() {
	m.Register(func(db dbx.Builder) error {
		dao := daos.New(db)

		// Update inventory collection schema
		collection, err := dao.FindCollectionByNameOrId("lji3c7jtcyl55iw")
		if err != nil {
			return err
		}

		// Add new fields
		collection.Schema.AddField(&schema.SchemaField{
			Name:     "unit_size",
			Type:     "text",
			Required: true,
		})

		collection.Schema.AddField(&schema.SchemaField{
			Name:     "strength",
			Type:     "text",
			Required: true,
		})

		// Add validation rules
		rule := "@request.auth.id != '' && @request.data.stock >= 0"
		collection.CreateRule = &rule
		collection.UpdateRule = &rule

		if err := dao.SaveCollection(collection); err != nil {
			return err
		}

		// Seed inventory data
		inventoryItems := []struct {
			DrugName     string  `json:"drug_name"`
			DrugCategory string  `json:"drug_category"`
			Stock        float64 `json:"stock"`
			FixedQty     float64 `json:"fixed_quantity"`
			UnitSize     string  `json:"unit_size"`
			Strength     string  `json:"strength"`
		}{
			{
				DrugName:     "Acetaminophen",
				DrugCategory: "Pain Relief",
				Stock:        100,
				FixedQty:     30,
				UnitSize:     "30ct",
				Strength:     "500mg",
			},
			{
				DrugName:     "Ibuprofen",
				DrugCategory: "Pain Relief",
				Stock:        150,
				FixedQty:     30,
				UnitSize:     "30ct",
				Strength:     "200mg",
			},
			{
				DrugName:     "Amoxicillin",
				DrugCategory: "Antibiotic",
				Stock:        50,
				FixedQty:     20,
				UnitSize:     "20ct",
				Strength:     "500mg",
			},
			{
				DrugName:     "Lisinopril",
				DrugCategory: "Blood Pressure",
				Stock:        75,
				FixedQty:     30,
				UnitSize:     "30ct",
				Strength:     "10mg",
			},
			{
				DrugName:     "Metformin",
				DrugCategory: "Diabetes",
				Stock:        60,
				FixedQty:     30,
				UnitSize:     "30ct",
				Strength:     "500mg",
			},
			{
				DrugName:     "Albuterol",
				DrugCategory: "Respiratory",
				Stock:        40,
				FixedQty:     1,
				UnitSize:     "1 inhaler",
				Strength:     "90mcg",
			},
		}

		for _, item := range inventoryItems {
			record := models.NewRecord(collection)
			record.Set("drug_name", item.DrugName)
			record.Set("drug_category", item.DrugCategory)
			record.Set("stock", item.Stock)
			record.Set("fixed_quantity", item.FixedQty)
			record.Set("unit_size", item.UnitSize)
			record.Set("strength", item.Strength)

			if err := dao.SaveRecord(record); err != nil {
				return err
			}
		}

		// Update disbursements collection
		disbursements, err := dao.FindCollectionByNameOrId("ohjfg1757c326vj")
		if err != nil {
			return err
		}

		// Add audit fields
		disbursements.Schema.AddField(&schema.SchemaField{
			Name:     "notes",
			Type:     "text",
			Required: false,
		})

		// Add validation rules
		disbursementRule := "@request.auth.id != '' && @request.data.quantity > 0 && @request.data.disbursement_multiplier > 0 && @collection.inventory.stock >= (@request.data.quantity * @request.data.disbursement_multiplier)"
		disbursements.CreateRule = &disbursementRule

		if err := dao.SaveCollection(disbursements); err != nil {
			return err
		}

		return nil
	}, func(db dbx.Builder) error {
		dao := daos.New(db)

		// Revert inventory collection changes
		collection, err := dao.FindCollectionByNameOrId("lji3c7jtcyl55iw")
		if err != nil {
			return err
		}

		collection.Schema.RemoveField("unit_size")
		collection.Schema.RemoveField("strength")
		defaultRule := "@request.auth.id != ''"
		collection.CreateRule = &defaultRule
		collection.UpdateRule = &defaultRule

		if err := dao.SaveCollection(collection); err != nil {
			return err
		}

		// Revert disbursements collection changes
		disbursements, err := dao.FindCollectionByNameOrId("ohjfg1757c326vj")
		if err != nil {
			return err
		}

		disbursements.Schema.RemoveField("notes")
		disbursements.CreateRule = &defaultRule

		if err := dao.SaveCollection(disbursements); err != nil {
			return err
		}

		return nil
	})
}
