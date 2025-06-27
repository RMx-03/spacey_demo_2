import json
import os

class MemorySystem:
    def __init__(self, file_path="student_data.json"):
        self.file_path = file_path
        self.data = self.load_data()

    def load_data(self):
        """load student data from the json file"""
        if os.path.exists(self.file_path):
            with open(self.file_path, 'r') as f:
                return json.load(f)
        return {}
    
    def save_data(self):
        """save data"""
        with open(self.file_path, 'w') as f:
            json.dump(self.data, f, indent=4)

    def update_traits(self, student_id, new_traits):
        """
        Update student traits.
        
        Args:
            student_id (str): Unique identifier for the student.
            new_traits (list): List of new traits to add.
        """
        if student_id not in self.data:
            self.data[student_id] = {"traits": []}
        self.data[student_id]["traits"] = list(set(self.data[student_id]["traits"] + new_traits))
        self.save_data()

    def get_traits(self, student_id): 
        """Get student traits."""
        return self.data.get(student_id, {}).get("traits", [])