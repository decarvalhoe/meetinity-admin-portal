import axios from 'axios'

export interface User {
  id: string
  name: string
  email: string
  status: string
  industry?: string
  createdAt?: string
}

const API = import.meta.env.VITE_API_BASE_URL

export interface ListParams {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  industry?: string
  startDate?: string
  endDate?: string
}

export interface Stats {
  signups: Record<string, number>
  byIndustry: Record<string, number>
  byStatus: Record<string, number>
}

export const UserService = {
  async list(params: ListParams) {
    const { data } = await axios.get(`${API}/api/users`, { params })
    return data as { users: User[]; total: number }
  },
  async update(id: string, payload: Partial<User>) {
    const { data } = await axios.put(`${API}/api/users/${id}`, payload)
    return data as User
  },
  async remove(id: string) {
    await axios.delete(`${API}/api/users/${id}`)
  },
  async bulk(ids: string[], action: 'activate' | 'deactivate' | 'delete') {
    await axios.post(`${API}/api/users/bulk`, { ids, action })
  },
  async stats() {
    const { data } = await axios.get(`${API}/api/users/stats`)
    return data as Stats
  },
  async export(params: ListParams) {
    const res = await axios.get(`${API}/api/users/export`, {
      params,
      responseType: 'blob'
    })
    return res.data as Blob
  }
}
