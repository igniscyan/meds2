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

		// Create admin user if it doesn't exist
		_, err := dao.FindAdminByEmail("user@example.com")
		if err != nil {
			admin := &models.Admin{}
			admin.Email = "user@example.com"
			admin.SetPassword("password123")
			if err := dao.SaveAdmin(admin); err != nil {
				return err
			}
		}

		// Ensure inventory collection exists
		inventory, err := dao.FindCollectionByNameOrId("inventory")
		if err != nil {
			// Create inventory collection if it doesn't exist
			inventory = &models.Collection{}
			inventory.Name = "inventory"
			inventory.Type = "base"
			inventory.ListRule = nil
			inventory.ViewRule = nil
			inventory.CreateRule = nil
			inventory.UpdateRule = nil
			inventory.DeleteRule = nil

			inventory.Schema = schema.NewSchema(
				&schema.SchemaField{
					Name:     "drug_name",
					Type:     "text",
					Required: true,
				},
				&schema.SchemaField{
					Name:     "drug_category",
					Type:     "text",
					Required: true,
				},
				&schema.SchemaField{
					Name:     "stock",
					Type:     "number",
					Required: true,
				},
				&schema.SchemaField{
					Name:     "fixed_quantity",
					Type:     "number",
					Required: true,
				},
			)
		}

		// Add new fields to inventory
		inventory.Schema.AddField(&schema.SchemaField{
			Name:     "unit_size",
			Type:     "text",
			Required: true,
		})

		inventory.Schema.AddField(&schema.SchemaField{
			Name:     "dose",
			Type:     "text",
			Required: true,
		})

		// Add validation rules for inventory
		rule := "@request.auth.id != ''"
		inventory.CreateRule = &rule
		inventory.UpdateRule = &rule
		inventory.ListRule = &rule
		inventory.ViewRule = &rule

		if err := dao.SaveCollection(inventory); err != nil {
			return err
		}

		// Ensure patients collection exists
		patients, err := dao.FindCollectionByNameOrId("patients")
		if err != nil {
			// Create patients collection if it doesn't exist
			patients = &models.Collection{}
			patients.Name = "patients"
			patients.Type = "base"
			patients.ListRule = nil
			patients.ViewRule = nil
			patients.CreateRule = nil
			patients.UpdateRule = nil
			patients.DeleteRule = nil

			patients.Schema = schema.NewSchema(
				&schema.SchemaField{
					Name:     "first_name",
					Type:     "text",
					Required: true,
				},
				&schema.SchemaField{
					Name:     "last_name",
					Type:     "text",
					Required: true,
				},
				&schema.SchemaField{
					Name:     "dob",
					Type:     "date",
					Required: true,
				},
				&schema.SchemaField{
					Name:     "gender",
					Type:     "text",
					Required: true,
				},
				&schema.SchemaField{
					Name:     "age",
					Type:     "number",
					Required: false,
				},
				&schema.SchemaField{
					Name:     "smoker",
					Type:     "text",
					Required: false,
				},
			)
		}

		// Add validation rules for patients
		authRule := "@request.auth.id != ''"
		patients.CreateRule = &authRule
		patients.UpdateRule = &authRule
		patients.ListRule = &authRule
		patients.ViewRule = &authRule

		if err := dao.SaveCollection(patients); err != nil {
			return err
		}

		// Ensure disbursements collection exists
		disbursements, err := dao.FindCollectionByNameOrId("disbursements")
		if err != nil {
			// Create disbursements collection if it doesn't exist
			disbursements = &models.Collection{}
			disbursements.Name = "disbursements"
			disbursements.Type = "base"
			disbursements.ListRule = nil
			disbursements.ViewRule = nil
			disbursements.CreateRule = nil
			disbursements.UpdateRule = nil
			disbursements.DeleteRule = nil

			maxSelect := 1
			disbursements.Schema = schema.NewSchema(
				&schema.SchemaField{
					Name: "encounter",
					Type: "relation",
					Options: &schema.RelationOptions{
						CollectionId: "encounters",
						MaxSelect:    &maxSelect,
					},
				},
				&schema.SchemaField{
					Name: "medication",
					Type: "relation",
					Options: &schema.RelationOptions{
						CollectionId: "inventory",
						MaxSelect:    &maxSelect,
					},
				},
				&schema.SchemaField{
					Name:     "quantity",
					Type:     "number",
					Required: true,
				},
				&schema.SchemaField{
					Name:     "notes",
					Type:     "text",
					Required: false,
				},
			)
		}

		// Add validation rules for disbursements
		disbursementRule := "@request.auth.id != ''"
		disbursements.CreateRule = &disbursementRule
		disbursements.UpdateRule = &disbursementRule
		disbursements.ListRule = &disbursementRule
		disbursements.ViewRule = &disbursementRule
		disbursements.DeleteRule = &disbursementRule

		if err := dao.SaveCollection(disbursements); err != nil {
			return err
		}

		// Ensure chief_complaints collection exists
		chiefComplaints, err := dao.FindCollectionByNameOrId("chief_complaints")
		if err != nil {
			// Create chief_complaints collection if it doesn't exist
			chiefComplaints = &models.Collection{}
			chiefComplaints.Name = "chief_complaints"
			chiefComplaints.Type = "base"
			chiefComplaints.ListRule = nil
			chiefComplaints.ViewRule = nil
			chiefComplaints.CreateRule = nil
			chiefComplaints.UpdateRule = nil
			chiefComplaints.DeleteRule = nil

			chiefComplaints.Schema = schema.NewSchema(
				&schema.SchemaField{
					Name:     "name",
					Type:     "text",
					Required: true,
				},
			)
		}

		// Add validation rules for chief_complaints
		complaintRule := "@request.auth.id != ''"
		chiefComplaints.CreateRule = &complaintRule
		chiefComplaints.UpdateRule = &complaintRule
		chiefComplaints.ListRule = &complaintRule
		chiefComplaints.ViewRule = &complaintRule

		if err := dao.SaveCollection(chiefComplaints); err != nil {
			return err
		}

		// Seed chief complaints data
		complaints := []string{
			"ABDOMINAL PAIN",
			"ANXIETY/NERVOUSNESS",
			"BACK PAIN",
			"CHEST PAIN",
			"COUGH",
			"DEPRESSION",
			"DIARRHEA",
			"DIZZINESS",
			"EARACHE",
			"FATGIUE",
			"FEVER/CHILLS/SWEATS",
			"HEADACHE",
			"JOINT PAIN",
			"NAUSEA",
			"NECK MASS",
			"NUMBNESS",
			"PALPITATIONS",
			"RASH",
			"SHORTNESS OF BREATH",
			"SOFT TISSUE INJURY",
			"SORE THROAT",
			"SWOLLEN GLANDS",
			"TENDER NECK",
			"UPPER RESPIRATORY SYMPTOMS",
			"URINARY SYMPTOMS",
			"VAGINAL DISCHARGE",
			"VOMITING",
			"VISION CHANGES",
		}

		for _, complaint := range complaints {
			record := models.NewRecord(chiefComplaints)
			record.Set("name", complaint)
			if err := dao.SaveRecord(record); err != nil {
				return err
			}
		}

		// Ensure encounter_question_categories collection exists
		questionCategories, err := dao.FindCollectionByNameOrId("encounter_question_categories")
		if err != nil {
			questionCategories = &models.Collection{}
			questionCategories.Name = "encounter_question_categories"
			questionCategories.Type = "base"
			questionCategories.ListRule = nil
			questionCategories.ViewRule = nil
			questionCategories.CreateRule = nil
			questionCategories.UpdateRule = nil
			questionCategories.DeleteRule = nil

			questionCategories.Schema = schema.NewSchema(
				&schema.SchemaField{
					Name:     "name",
					Type:     "text",
					Required: true,
				},
				&schema.SchemaField{
					Name:     "order",
					Type:     "number",
					Required: true,
				},
				&schema.SchemaField{
					Name:     "type",
					Type:     "select",
					Required: true,
					Options: &schema.SelectOptions{
						Values: []string{"checkbox", "survey"},
					},
				},
				&schema.SchemaField{
					Name:     "archived",
					Type:     "bool",
					Required: true,
				},
			)
		}

		// Add validation rules for question categories
		categoryRule := "@request.auth.id != ''"
		questionCategories.CreateRule = &categoryRule
		questionCategories.UpdateRule = &categoryRule
		questionCategories.ListRule = &categoryRule
		questionCategories.ViewRule = &categoryRule

		if err := dao.SaveCollection(questionCategories); err != nil {
			return err
		}

		// Ensure encounter_questions collection exists
		questions, err := dao.FindCollectionByNameOrId("encounter_questions")
		if err != nil {
			questions = &models.Collection{}
			questions.Name = "encounter_questions"
			questions.Type = "base"
			questions.ListRule = nil
			questions.ViewRule = nil
			questions.CreateRule = nil
			questions.UpdateRule = nil
			questions.DeleteRule = nil

			questions.Schema = schema.NewSchema(
				&schema.SchemaField{
					Name:     "question_text",
					Type:     "text",
					Required: true,
				},
				&schema.SchemaField{
					Name:     "input_type",
					Type:     "select",
					Required: true,
					Options: &schema.SelectOptions{
						Values: []string{"checkbox", "text", "select"},
					},
				},
				&schema.SchemaField{
					Name:     "description",
					Type:     "text",
					Required: false,
				},
				&schema.SchemaField{
					Name:     "options",
					Type:     "json",
					Required: false,
				},
				&schema.SchemaField{
					Name: "category",
					Type: "relation",
					Options: &schema.RelationOptions{
						CollectionId: "encounter_question_categories",
						MaxSelect:    1,
					},
					Required: true,
				},
				&schema.SchemaField{
					Name:     "order",
					Type:     "number",
					Required: true,
				},
				&schema.SchemaField{
					Name:     "archived",
					Type:     "bool",
					Required: true,
				},
			)
		}

		// Add validation rules for questions
		questionRule := "@request.auth.id != ''"
		questions.CreateRule = &questionRule
		questions.UpdateRule = &questionRule
		questions.ListRule = &questionRule
		questions.ViewRule = &questionRule

		if err := dao.SaveCollection(questions); err != nil {
			return err
		}

		// Seed some initial categories
		categories := []struct {
			Name  string
			Type  string
			Order float64
		}{
			{"Standard Items", "checkbox", 1},
			{"Patient Satisfaction", "survey", 2},
			{"Treatment Feedback", "survey", 3},
		}

		for _, category := range categories {
			record := models.NewRecord(questionCategories)
			record.Set("name", category.Name)
			record.Set("type", category.Type)
			record.Set("order", category.Order)
			record.Set("archived", false)
			if err := dao.SaveRecord(record); err != nil {
				return err
			}
		}

		// Seed some initial checkbox questions for standard items
		standardItems := []struct {
			Text  string
			Order float64
		}{
			{"Sunglasses", 1},
			{"Water Bottle", 2},
			{"Information Packet", 3},
		}

		standardCategory, err := dao.FindFirstRecordByData("encounter_question_categories", "name", "Standard Items")
		if err == nil {
			for _, item := range standardItems {
				record := models.NewRecord(questions)
				record.Set("question_text", item.Text)
				record.Set("input_type", "checkbox")
				record.Set("category", standardCategory.Id)
				record.Set("order", item.Order)
				record.Set("archived", false)
				if err := dao.SaveRecord(record); err != nil {
					return err
				}
			}
		}

		// Ensure encounter_responses collection exists
		responses, err := dao.FindCollectionByNameOrId("encounter_responses")
		if err != nil {
			responses = &models.Collection{}
			responses.Name = "encounter_responses"
			responses.Type = "base"
			responses.ListRule = nil
			responses.ViewRule = nil
			responses.CreateRule = nil
			responses.UpdateRule = nil
			responses.DeleteRule = nil

			maxSelect := 1
			responses.Schema = schema.NewSchema(
				&schema.SchemaField{
					Name: "encounter",
					Type: "relation",
					Options: &schema.RelationOptions{
						CollectionId: "encounters",
						MaxSelect:    &maxSelect,
					},
					Required: true,
				},
				&schema.SchemaField{
					Name: "question",
					Type: "relation",
					Options: &schema.RelationOptions{
						CollectionId: "encounter_questions",
						MaxSelect:    &maxSelect,
					},
					Required: true,
				},
				&schema.SchemaField{
					Name:     "response_value",
					Type:     "json",
					Required: true,
				},
			)
		}

		// Add validation rules for responses
		responseRule := "@request.auth.id != ''"
		responses.CreateRule = &responseRule
		responses.UpdateRule = &responseRule
		responses.ListRule = &responseRule
		responses.ViewRule = &responseRule

		if err := dao.SaveCollection(responses); err != nil {
			return err
		}

		// Ensure encounters collection exists
		encounters, err := dao.FindCollectionByNameOrId("encounters")
		if err != nil {
			// Create encounters collection if it doesn't exist
			encounters = &models.Collection{}
			encounters.Name = "encounters"
			encounters.Type = "base"
			encounters.ListRule = nil
			encounters.ViewRule = nil
			encounters.CreateRule = nil
			encounters.UpdateRule = nil
			encounters.DeleteRule = nil

			encounters.Schema = schema.NewSchema(
				&schema.SchemaField{
					Name: "patient",
					Type: "relation",
					Options: &schema.RelationOptions{
						CollectionId:  "patients",
						CascadeDelete: false,
						MaxSelect:     &[]int{1}[0],
					},
					Required: false,
				},
				&schema.SchemaField{
					Name:     "height_inches",
					Type:     "number",
					Required: false,
					Options: &schema.NumberOptions{
						NoDecimal: true,
					},
				},
				&schema.SchemaField{
					Name:     "weight",
					Type:     "number",
					Required: false,
					Options: &schema.NumberOptions{
						NoDecimal: false,
					},
				},
				&schema.SchemaField{
					Name:     "temperature",
					Type:     "number",
					Required: false,
					Options: &schema.NumberOptions{
						NoDecimal: false,
					},
				},
				&schema.SchemaField{
					Name:     "heart_rate",
					Type:     "number",
					Required: false,
					Options: &schema.NumberOptions{
						NoDecimal: true,
					},
				},
				&schema.SchemaField{
					Name:     "systolic_pressure",
					Type:     "number",
					Required: false,
					Options: &schema.NumberOptions{
						NoDecimal: true,
					},
				},
				&schema.SchemaField{
					Name:     "diastolic_pressure",
					Type:     "number",
					Required: false,
					Options: &schema.NumberOptions{
						NoDecimal: true,
					},
				},
				&schema.SchemaField{
					Name:     "chief_complaint",
					Type:     "select",
					Required: false,
					Options: &schema.SelectOptions{
						MaxSelect: 2,
						Values: []string{
							"sample1",
							"sample2",
							"sample3",
						},
					},
				},
			)
		}

		// Add validation rules for encounters
		encounters.CreateRule = &authRule
		encounters.UpdateRule = &authRule
		encounters.ListRule = &authRule
		encounters.ViewRule = &authRule

		if err := dao.SaveCollection(encounters); err != nil {
			return err
		}

		// Create queue collection
		queueCollection, err := dao.FindCollectionByNameOrId("queue")
		if err != nil {
			// Create queue collection if it doesn't exist
			queueCollection = &models.Collection{}
			queueCollection.Name = "queue"
			queueCollection.Type = "base"

			queueCollection.Schema = schema.NewSchema(
				&schema.SchemaField{
					Name:     "patient",
					Type:     "relation",
					Required: true,
					Options: &schema.RelationOptions{
						CollectionId: "patients",
						MinSelect:    nil,
						MaxSelect:    nil,
					},
				},
				&schema.SchemaField{
					Name:     "status",
					Type:     "select",
					Required: true,
					Options: &schema.SelectOptions{
						Values: []string{"waiting", "in_progress", "completed"},
					},
				},
				&schema.SchemaField{
					Name:     "assigned_to",
					Type:     "relation",
					Required: false,
					Options: &schema.RelationOptions{
						CollectionId: "users",
						MinSelect:    nil,
						MaxSelect:    nil,
					},
				},
				&schema.SchemaField{
					Name:     "check_in_time",
					Type:     "date",
					Required: true,
				},
				&schema.SchemaField{
					Name:     "start_time",
					Type:     "date",
					Required: false,
				},
				&schema.SchemaField{
					Name:     "end_time",
					Type:     "date",
					Required: false,
				},
				&schema.SchemaField{
					Name:     "priority",
					Type:     "number",
					Required: true,
					Options: &schema.NumberOptions{
						Min: float64Ptr(1.0),
						Max: float64Ptr(5.0),
					},
				},
			)

			// Set validation rules
			queueRule := "@request.auth.id != ''"
			queueCollection.ListRule = &queueRule
			queueCollection.ViewRule = &queueRule
			queueCollection.CreateRule = &queueRule
			queueCollection.UpdateRule = &queueRule
			queueCollection.DeleteRule = &queueRule

			if err := dao.SaveCollection(queueCollection); err != nil {
				return err
			}
		}

		// Seed inventory data
		inventoryItems := []struct {
			DrugName     string  `json:"drug_name"`
			DrugCategory string  `json:"drug_category"`
			Stock        float64 `json:"stock"`
			FixedQty     float64 `json:"fixed_quantity"`
			UnitSize     string  `json:"unit_size"`
			Dose         string  `json:"dose"`
		}{
			{
				DrugName:     "Acetaminophen",
				DrugCategory: "Pain Relief",
				Stock:        100,
				FixedQty:     30,
				UnitSize:     "30ct",
				Dose:         "500mg",
			},
			{
				DrugName:     "Ibuprofen",
				DrugCategory: "Pain Relief",
				Stock:        150,
				FixedQty:     30,
				UnitSize:     "30ct",
				Dose:         "200mg",
			},
			{
				DrugName:     "Amoxicillin",
				DrugCategory: "Antibiotic",
				Stock:        50,
				FixedQty:     20,
				UnitSize:     "20ct",
				Dose:         "500mg",
			},
			{
				DrugName:     "Lisinopril",
				DrugCategory: "Blood Pressure",
				Stock:        75,
				FixedQty:     30,
				UnitSize:     "30ct",
				Dose:         "10mg",
			},
			{
				DrugName:     "Metformin",
				DrugCategory: "Diabetes",
				Stock:        60,
				FixedQty:     30,
				UnitSize:     "30ct",
				Dose:         "500mg",
			},
			{
				DrugName:     "Albuterol",
				DrugCategory: "Respiratory",
				Stock:        40,
				FixedQty:     1,
				UnitSize:     "1 inhaler",
				Dose:         "90mcg",
			},
		}

		for _, item := range inventoryItems {
			record := models.NewRecord(inventory)
			record.Set("drug_name", item.DrugName)
			record.Set("drug_category", item.DrugCategory)
			record.Set("stock", item.Stock)
			record.Set("fixed_quantity", item.FixedQty)
			record.Set("unit_size", item.UnitSize)
			record.Set("dose", item.Dose)

			if err := dao.SaveRecord(record); err != nil {
				return err
			}
		}

		return nil
	}, func(db dbx.Builder) error {
		dao := daos.New(db)

		// Revert inventory collection changes
		inventory, err := dao.FindCollectionByNameOrId("inventory")
		if err != nil {
			return err
		}

		inventory.Schema.RemoveField("unit_size")
		inventory.Schema.RemoveField("dose")

		defaultRule := "@request.auth.id != ''"
		inventory.CreateRule = &defaultRule
		inventory.UpdateRule = &defaultRule

		if err := dao.SaveCollection(inventory); err != nil {
			return err
		}

		// Revert disbursements collection changes
		disbursements, err := dao.FindCollectionByNameOrId("disbursements")
		if err != nil {
			return err
		}

		disbursements.CreateRule = &defaultRule
		disbursements.UpdateRule = &defaultRule

		if err := dao.SaveCollection(disbursements); err != nil {
			return err
		}

		// Revert encounters collection changes
		encounters, err := dao.FindCollectionByNameOrId("encounters")
		if err != nil {
			return err
		}

		encounters.CreateRule = &defaultRule
		encounters.UpdateRule = &defaultRule

		if err := dao.SaveCollection(encounters); err != nil {
			return err
		}

		// Revert queue collection changes
		queueCollection, err := dao.FindCollectionByNameOrId("queue")
		if err != nil {
			return err
		}

		queueCollection.DeleteRule = &defaultRule
		queueCollection.CreateRule = &defaultRule
		queueCollection.UpdateRule = &defaultRule
		queueCollection.ListRule = &defaultRule
		queueCollection.ViewRule = &defaultRule

		if err := dao.SaveCollection(queueCollection); err != nil {
			return err
		}

		// Revert chief_complaints collection changes
		chiefComplaints, err := dao.FindCollectionByNameOrId("chief_complaints")
		if err != nil {
			return err
		}

		chiefComplaints.CreateRule = &defaultRule
		chiefComplaints.UpdateRule = &defaultRule
		chiefComplaints.ListRule = &defaultRule
		chiefComplaints.ViewRule = &defaultRule

		if err := dao.SaveCollection(chiefComplaints); err != nil {
			return err
		}

		// Revert encounter_question_categories collection changes
		questionCategories, err := dao.FindCollectionByNameOrId("encounter_question_categories")
		if err != nil {
			return err
		}

		questionCategories.CreateRule = &defaultRule
		questionCategories.UpdateRule = &defaultRule
		questionCategories.ListRule = &defaultRule
		questionCategories.ViewRule = &defaultRule

		if err := dao.SaveCollection(questionCategories); err != nil {
			return err
		}

		// Revert encounter_questions collection changes
		questions, err := dao.FindCollectionByNameOrId("encounter_questions")
		if err != nil {
			return err
		}

		questions.CreateRule = &defaultRule
		questions.UpdateRule = &defaultRule
		questions.ListRule = &defaultRule
		questions.ViewRule = &defaultRule

		if err := dao.SaveCollection(questions); err != nil {
			return err
		}

		// Revert encounter_responses collection changes
		responses, err := dao.FindCollectionByNameOrId("encounter_responses")
		if err != nil {
			return err
		}

		responses.CreateRule = &defaultRule
		responses.UpdateRule = &defaultRule
		responses.ListRule = &defaultRule
		responses.ViewRule = &defaultRule

		if err := dao.SaveCollection(responses); err != nil {
			return err
		}

		return nil
	})
}

func float64Ptr(v float64) *float64 {
	return &v
}
