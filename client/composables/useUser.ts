
export const useUser = async (uid: any) => {
  const username = ref<string>(undefined)
  const type = ref<string>(undefined)
  const account = ref<string>(undefined)
  const file = ref<Blob>(undefined)
  const imageURL = ref<Object>(undefined)
  const client = useSupabaseClient()

  const getProfilePicture = async (username: string) => {
    const { data: download, error } = await client
      .storage
      .from("designs")
      .download(`${username}.jpg`)
    file.value = download
    if (error) {
      console.log(error)
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      imageURL.value = event.target.result
    }
    reader.readAsDataURL(file.value)
  }

  if (uid) {
    try {
      const { data, error } = await client.from("usernames").select("*").eq("id", uid).single()
      if (error) { throw error }
      username.value = data.username
      type.value = data.type
      account.value = data.account

      await getProfilePicture(username.value)

      // return other username data (account type ?)
    } catch (error) {
      console.log(error)
    }
  }

  return {
    account: account.value,
    imageURL: imageURL.value,
    type: type.value,
    username: username.value
  }
}
